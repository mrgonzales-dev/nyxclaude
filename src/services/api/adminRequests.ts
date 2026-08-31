// ponytail: Admin requests removed — Anthropic enterprise feature.
export type AdminRequestType = 'limit_increase' | 'seat_upgrade'
export type AdminRequestStatus = 'pending' | 'approved' | 'dismissed'
export type AdminRequestSeatUpgradeDetails = { message?: string | null; current_seat_tier?: string | null }
export type AdminRequestCreateParams = { request_type: AdminRequestType; details: unknown }
export type AdminRequest = { id: string; request_type: AdminRequestType; status: AdminRequestStatus }
export async function createAdminRequest(_params: AdminRequestCreateParams): Promise<AdminRequest> {
  throw new Error('Admin requests not available')
}
export async function getMyAdminRequests(): Promise<AdminRequest[]> { return [] }
export async function checkAdminRequestEligibility(): Promise<boolean> { return false }
