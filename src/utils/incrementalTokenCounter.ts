/**
 * High-performance token counter with cache invalidation on content change.
 */

import { createHash } from 'crypto'
import { roughTokenCountEstimation, roughTokenCountEstimationForMessages } from '../services/tokenEstimation.js'
import type { Message } from '../types/message.js'

export interface IncrementalCounterConfig {
  /** Token budget for context limit decisions (e.g., model context window) */
  tokenBudget?: number
  /** Enable auto-invalidation on size change */
  autoInvalidate?: boolean
  /** Custom estimation multiplier */
  estimationMultiplier?: number
}

export interface CounterStats {
  hits: number
  misses: number
  totalTokens: number
  averageTokens: number
  hitRate: number
}

/**
 * Hash a single message's token-relevant content.
 * Returns a 32-byte Buffer (SHA-256 digest).
 */
function hashSingleMessage(message: Message): Buffer {
  const input = JSON.stringify({
    type: message.type,
    content: message.message?.content ?? null,
    attachment: message.attachment ?? null,
  })
  return createHash('sha256').update(input).digest()
}

/**
 * Combine previous rolling hash with a message hash (order-sensitive).
 * newHash = sha256(prev || msgHash)
 * Chained, so [A,B] != [B,A] and [A,A] != []. Preserves O(new) appends.
 */
function combineHash(prev: Buffer, msgHash: Buffer): Buffer {
  return createHash('sha256').update(prev).update(msgHash).digest()
}

/**
 * Compute a rolling hash from scratch by chaining individual message hashes.
 * Used on cache miss / full recompute — the incremental path avoids this.
 */
function computeRollingHash(messages: readonly Message[]): Buffer {
  let hash: Buffer = Buffer.alloc(32) // all-zeros = initial chaining value
  for (const msg of messages) {
    hash = combineHash(hash, hashSingleMessage(msg))
  }
  return hash
}

/**
 * High-performance incremental token counter with content-aware invalidation.
 */
export class IncrementalTokenCounter {
  private lastMessageCount = 0
  private lastTokenCount = 0
  /** Rolling chained hash of all messages seen so far — the cache key. */
  private lastRollingHash: Buffer = Buffer.alloc(32)
  /** Reference to the last messages array for O(1) same-array fast path. */
  private lastMessagesRef: readonly Message[] | null = null
  /** Shallow copy of message refs for prefix verification on append. */
  private lastMessageRefs: readonly Message[] = []
  private config: Required<IncrementalCounterConfig>
  private stats = {
    hits: 0,
    misses: 0,
    totalTokens: 0,
  }

  constructor(config: IncrementalCounterConfig = {}) {
    this.config = {
      tokenBudget: config.tokenBudget ?? 100000,
      autoInvalidate: config.autoInvalidate ?? true,
      estimationMultiplier: config.estimationMultiplier ?? 1,
    }
  }

  /**
   * Get token count using cache when possible.
   * O(1) for same-array calls, O(new messages) for appends, O(n) for cache miss.
   */
  getCount(messages: readonly Message[]): number {
    if (messages.length === 0) {
      this.reset()
      return 0
    }

    // O(1) fast path: same array reference — nothing could have changed
    if (messages === this.lastMessagesRef && this.lastMessageCount > 0) {
      this.stats.hits++
      this.stats.totalTokens += this.lastTokenCount
      return this.lastTokenCount
    }

    // Same message count — verify content via rolling hash (cache key)
    if (messages.length === this.lastMessageCount && this.lastMessageCount > 0) {
      const currentHash = computeRollingHash(messages)
      if (currentHash.equals(this.lastRollingHash)) {
        // Cache hit: content unchanged (different array, same content)
        this.stats.hits++
        this.stats.totalTokens += this.lastTokenCount
        this.lastMessagesRef = messages
        return this.lastTokenCount
      }
      // Hash mismatch — fall through to full recompute
    }

    this.stats.misses++

    // Incremental path: messages appended and auto-invalidate enabled.
    // Verify prefix via reference equality (cheap O(n) pointer compares, no
    // hashing), then hash ONLY the new messages and chain-combine.
    if (
      this.config.autoInvalidate &&
      messages.length > this.lastMessageCount &&
      this.lastMessageCount > 0
    ) {
      let prefixUnchanged = true
      for (let i = 0; i < this.lastMessageCount; i++) {
        if (messages[i] !== this.lastMessageRefs[i]) {
          prefixUnchanged = false
          break
        }
      }

      if (prefixUnchanged) {
        // Hash only new messages and chain with existing rolling hash:
        //   newHash = sha256(...sha256(oldHash || hash(newMsg)))
        let newHash = this.lastRollingHash
        for (let i = this.lastMessageCount; i < messages.length; i++) {
          newHash = combineHash(newHash, hashSingleMessage(messages[i]))
        }
        this.lastRollingHash = newHash

        const newMessages = messages.slice(this.lastMessageCount)
        const estimated = Math.round(
          roughTokenCountEstimationForMessages(newMessages) * this.config.estimationMultiplier
        )
        this.lastTokenCount += estimated
        this.lastMessageCount = messages.length
        this.lastMessagesRef = messages
        this.lastMessageRefs = messages.slice()
        this.stats.totalTokens += this.lastTokenCount
        return this.lastTokenCount
      }
      // Prefix mutated — fall through to full recompute
    }

    // Full recompute (cache miss / hash mismatch / count decreased / prefix mutated)
    this.lastRollingHash = computeRollingHash(messages)
    this.lastTokenCount = roughTokenCountEstimationForMessages(messages)
    this.lastMessageCount = messages.length
    this.lastMessagesRef = messages
    this.lastMessageRefs = messages.slice()
    this.stats.totalTokens += this.lastTokenCount

    return this.lastTokenCount
  }

  /**
   * Force recalculate from full context.
   * Use when context changed externally.
   */
  invalidate(messages: readonly Message[]): number {
    this.lastMessageCount = messages.length
    this.lastRollingHash = messages.length > 0 ? computeRollingHash(messages) : Buffer.alloc(32)
    this.lastMessagesRef = messages.length > 0 ? messages : null
    this.lastMessageRefs = messages.slice()

    if (messages.length === 0) {
      this.lastTokenCount = 0
    } else {
      this.lastTokenCount = roughTokenCountEstimationForMessages(messages)
    }
    
    this.stats.totalTokens += this.lastTokenCount
    this.stats.misses++
    
    return this.lastTokenCount
  }

  /**
   * Estimate token count without caching.
   * Useful for read-only estimates.
   */
  estimate(messages: readonly Message[]): number {
    return roughTokenCountEstimationForMessages(messages)
  }

  /**
   * Get token count for a single message.
   */
  estimateMessage(message: Message): number {
    if (typeof message.message?.content === 'string') {
      return roughTokenCountEstimation(message.message.content)
    }
    if (Array.isArray(message.message?.content)) {
      return message.message.content.reduce((sum, block) => {
        if ('text' in block) return sum + roughTokenCountEstimation(block.text || '')
        if ('thinking' in block) return sum + roughTokenCountEstimation(block.thinking || '')
        return sum + 100 // Default for other block types
      }, 0)
    }
    return 100 // Default estimate
  }

  /**
   * Batch estimate for multiple messages.
   */
  estimateBatch(messages: Message[]): number {
    return messages.reduce((sum, msg) => sum + this.estimateMessage(msg), 0)
  }

  /**
   * Get remaining budget in context window.
   */
  getRemainingBudget(messages: readonly Message[], contextWindow: number): number {
    const used = this.getCount(messages)
    return Math.max(0, contextWindow - used)
  }

  /**
   * Check if approaching limit.
   */
  isApproachingLimit(messages: readonly Message[], threshold: number = 0.8): boolean {
    return this.lastMessageCount > 0 && 
           (this.lastTokenCount / this.config.tokenBudget) > threshold
  }

  /** Reset all state */
  reset(): void {
    this.lastMessageCount = 0
    this.lastTokenCount = 0
    this.lastRollingHash = Buffer.alloc(32)
    this.lastMessagesRef = null
    this.lastMessageRefs = []
    this.stats = { hits: 0, misses: 0, totalTokens: 0 }
  }

  /** Get current cached count */
  get cachedCount(): number {
    return this.lastTokenCount
  }

  /** Get message count */
  get messageCount(): number {
    return this.lastMessageCount
  }

  /** Get statistics */
  getStats(): CounterStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      totalTokens: this.stats.totalTokens,
      averageTokens: total > 0 ? Math.round(this.stats.totalTokens / total) : 0,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) : 0,
    }
  }

  /** Update configuration dynamically */
  updateConfig(config: Partial<IncrementalCounterConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      tokenBudget: config.tokenBudget ?? this.config.tokenBudget,
      autoInvalidate: config.autoInvalidate ?? this.config.autoInvalidate,
      estimationMultiplier: config.estimationMultiplier ?? this.config.estimationMultiplier,
    }
  }
}

/**
 * Factory for creating pre-configured counters.
 */
export const CounterFactory = {
  realtime(): IncrementalTokenCounter {
    return new IncrementalTokenCounter({
      tokenBudget: 50000,
      autoInvalidate: true,
      estimationMultiplier: 1.1,
    })
  },

  batch(): IncrementalTokenCounter {
    return new IncrementalTokenCounter({
      tokenBudget: 200000,
      autoInvalidate: false,
      estimationMultiplier: 1.0,
    })
  },

  lightweight(): IncrementalTokenCounter {
    return new IncrementalTokenCounter({
      tokenBudget: 10000,
      autoInvalidate: true,
      estimationMultiplier: 1.2,
    })
  },
}
