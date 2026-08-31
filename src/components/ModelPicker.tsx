import capitalize from 'lodash-es/capitalize.js';
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useExitOnCtrlCDWithKeybindings } from '../hooks/useExitOnCtrlCDWithKeybindings.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../services/analytics/index.js';
import { FAST_MODE_MODEL_DISPLAY, isFastModeAvailable, isFastModeCooldown, isFastModeEnabled } from '../utils/fastMode.js';
import { Box, Text } from '../ink.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import { convertEffortValueToLevel, type EffortLevel, getAvailableEffortLevels, getDefaultEffortForModel, modelSupportsEffort, modelSupportsMaxEffort, resolvePickerEffortPersistence, toPersistableEffort } from '../utils/effort.js';
import { isModelAllowed } from '../utils/model/modelAllowlist.js';
import { getDefaultMainLoopModel, type ModelSetting, modelDisplayString, parseUserSpecifiedModel } from '../utils/model/model.js';
import { fuzzySearch } from '../utils/model/fuzzySearch.js';
import { getModelOptions, type ModelOption, parseSwitchProfileValue, resolveSelectedSwitchProfileId } from '../utils/model/modelOptions.js';
import { getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings.js';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js';
import { Select } from './CustomSelect/index.js';
import { Byline } from './design-system/Byline.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { Pane } from './design-system/Pane.js';
import { effortLevelToSymbol } from './EffortIndicator.js';

export type ModelPickerDiscoveryState = {
  message: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
};

export type Props = {
  initial: string | null;
  sessionModel?: ModelSetting;
  /**
   * `switchToProfileId` is the marker of the selected cross-profile option
   * (issue #1119). It is defined only when the picked option is a genuine
   * "switch profile" entry, so consumers must gate profile activation on this
   * marker rather than re-parsing the encoded value — a literal custom model id
   * that merely starts with `__switch_profile__:` arrives with it undefined.
   */
  onSelect: (
    model: string | null,
    effort: EffortLevel | undefined,
    switchToProfileId?: string,
  ) => void;
  onCancel?: () => void;
  isStandaloneCommand?: boolean;
  showFastModeNotice?: boolean;
  /** Overrides the dim header line below "Select model". */
  headerText?: string;
  /**
   * When true, skip writing effortLevel to userSettings on selection.
   * Used by the assistant installer wizard where the model choice is
   * project-scoped (written to the assistant's .nyxclaude/settings.json via
   * install.ts) and should not leak to the user's global ~/.nyxclaude/settings.json.
   */
  skipSettingsWrite?: boolean;
  optionsOverride?: ModelOption[];
  discoveryState?: ModelPickerDiscoveryState;
  onRefresh?: () => void;
  /**
   * Allow cross-profile "switch profile" options (issue #1119) to appear in the
   * list. These carry an encoded `__switch_profile__:<id>:<model>` value that
   * only the `/model` command's onSelect knows how to activate. Inline pickers
   * (prompt hotkey, Settings) that write the raw value to `mainLoopModel` must
   * leave this off so they never surface an option they cannot honor.
   */
  allowProfileSwitch?: boolean;
};

const NO_PREFERENCE = '__NO_PREFERENCE__';

function normalizeModelPickerValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : null;
}

function optionMatchesPickerValue(option: ModelOption, value: string): boolean {
  const optionKey = normalizeModelPickerValue(option.value);
  const valueKey = normalizeModelPickerValue(value);
  return optionKey !== null && valueKey !== null && optionKey === valueKey;
}

function resolvePickerOptionValue(options: ModelOption[], value: string): string | undefined {
  const optionValue = options.find(option => optionMatchesPickerValue(option, value))?.value;
  return typeof optionValue === 'string' ? optionValue : undefined;
}

function mapDiscoveryToneToColor(tone: ModelPickerDiscoveryState['tone']): 'error' | 'warning' | 'success' | 'subtle' {
  switch (tone) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    case 'info':
    default:
      return 'subtle';
  }
}

function mapOptionForSelect(option: ModelOption): ModelOption {
  return {
    ...option,
    value: option.value === null ? NO_PREFERENCE : option.value,
  };
}

// A picker value is a genuine cross-profile switch only when the option with
// that exact value carries the `switchToProfileId` marker. A literal custom
// model id that merely starts with `__switch_profile__:` is a plain option with
// no marker and must NOT be decoded — otherwise the display resolver would
// strip a real model id down to its `:`-tail. getModelOptions() is the
// authority for the switch options (they only appear in the base list, never in
// a discovery override, and discovered ids never carry the prefix). If two
// options share the value (a literal id colliding with an encoded switch
// value), the match is ambiguous, so require exactly one option and treat that
// lone option's marker as authoritative.
function isGenuineSwitchProfileValue(value: string): boolean {
  return resolveSelectedSwitchProfileId(getModelOptions(), value) !== undefined;
}

function resolveOptionModel(value?: string): string | undefined {
  if (!value) return undefined;
  if (value === NO_PREFERENCE) return getDefaultMainLoopModel();
  // Cross-profile entries from /model encode the picker value as
  // `__switch_profile__:<profileId>:<model>`. Effort / display logic needs
  // the bare target model id (e.g. `gpt-5.4`) — otherwise
  // `modelSupportsEffort` sees the prefixed string and reports
  // "Effort not supported" even for reasoning-capable models. Decode only when
  // the value is a genuine marker-backed switch option, not any prefixed id.
  const switched = isGenuineSwitchProfileValue(value)
    ? parseSwitchProfileValue(value)
    : null;
  return parseUserSpecifiedModel(switched ? switched.model : value);
}

function cycleEffortLevel(current: EffortLevel, direction: 'left' | 'right', levels: EffortLevel[]): EffortLevel {
  // If the current level isn't in the cycle (e.g. 'max' after switching to a
  // non-max model), clamp to 'high'.
  const idx = levels.indexOf(current);
  const currentIndex = idx !== -1 ? idx : levels.indexOf('high');
  if (direction === 'right') {
    return levels[(currentIndex + 1) % levels.length]!;
  } else {
    return levels[(currentIndex - 1 + levels.length) % levels.length]!;
  }
}

function getDefaultEffortLevelForOption(value?: string): EffortLevel {
  const resolved = resolveOptionModel(value) ?? getDefaultMainLoopModel();
  const defaultValue = getDefaultEffortForModel(resolved);
  return defaultValue !== undefined ? convertEffortValueToLevel(defaultValue) : 'high';
}

function EffortLevelIndicator({ effort }: { effort: EffortLevel | undefined }) {
  const color = effort ? 'claude' : 'subtle';
  const level = effort ?? 'low';
  const symbol = effortLevelToSymbol(level);
  return <Text color={color}>{symbol}</Text>;
}

export function ModelPicker(props: Props) {
  const {
    initial,
    sessionModel,
    onSelect,
    onCancel,
    isStandaloneCommand,
    showFastModeNotice,
    headerText,
    skipSettingsWrite,
    optionsOverride,
    discoveryState,
    onRefresh,
    allowProfileSwitch,
  } = props;

  const setAppState = useSetAppState();
  const exitState = useExitOnCtrlCDWithKeybindings();
  const initialValue = initial === null ? NO_PREFERENCE : initial;
  const isFastMode = useAppState(s => (isFastModeEnabled() ? s.fastMode : false));
  const effortValue = useAppState(s => s.effortValue);
  const [hasToggledEffort, setHasToggledEffort] = useState(false);
  const [effort, setEffort] = useState<EffortLevel | undefined>(
    effortValue !== undefined ? convertEffortValueToLevel(effortValue) : undefined,
  );
  const [searchQuery, setSearchQuery] = useState('');

  const modelOptionsBase = useMemo(
    () => optionsOverride ?? getModelOptions(isFastMode ?? false),
    [optionsOverride, isFastMode],
  );

  // Cross-profile switch options can only be honored by the /model command's
  // onSelect, which decodes the value and activates the target profile. Strip
  // them for inline pickers (allowProfileSwitch falsy) so a hotkey/Settings
  // selection never writes the raw `__switch_profile__:...` value as a model.
  // Key on the `switchToProfileId` marker, not the raw value prefix, so a real
  // custom model id that merely starts with `__switch_profile__:` is not hidden.
  const modelOptions = useMemo(
    () =>
      allowProfileSwitch
        ? modelOptionsBase
        : modelOptionsBase.filter(opt => opt.switchToProfileId === undefined),
    [allowProfileSwitch, modelOptionsBase],
  );

  const optionsWithInitial = useMemo(() => {
    if (
      initial !== null &&
      isModelAllowed(initial) &&
      !modelOptions.some(opt => optionMatchesPickerValue(opt, initial))
    ) {
      return [
        ...modelOptions,
        {
          value: initial,
          label: modelDisplayString(initial),
          description: 'Current model',
        },
      ];
    }
    return modelOptions;
  }, [initial, modelOptions]);

  const selectOptions = useMemo(
    () => optionsWithInitial.map(mapOptionForSelect),
    [optionsWithInitial],
  );

  const filteredOptions = useMemo(() => {
    if (searchQuery.trim()) {
      return fuzzySearch(selectOptions, searchQuery);
    }
    return selectOptions;
  }, [selectOptions, searchQuery]);

  const initialFocusValue = useMemo(() => {
    return (
      filteredOptions.find(opt => optionMatchesPickerValue(opt, initialValue))?.value ??
      filteredOptions[0]?.value ??
      undefined
    );
  }, [filteredOptions, initialValue]);

  const [focusedValue, setFocusedValue] = useState(initialFocusValue ?? initialValue);

  // Keep focus aligned when filtered options change from search.
  React.useEffect(() => {
    if (focusedValue === undefined) {
      setFocusedValue(initialFocusValue ?? initialValue);
      return;
    }
    const stillPresent = filteredOptions.some(opt => opt.value === focusedValue);
    if (!stillPresent) {
      setFocusedValue(initialFocusValue ?? initialValue);
    }
  }, [filteredOptions, focusedValue, initialFocusValue, initialValue]);

  const focusedModelName = useMemo(() => {
    return filteredOptions.find(opt => opt.value === focusedValue)?.label;
  }, [filteredOptions, focusedValue]);

  const focusedModel = useMemo(() => resolveOptionModel(focusedValue), [focusedValue]);
  const focusedSupportsEffort = focusedModel ? modelSupportsEffort(focusedModel) : false;
  const focusedSupportsMax = focusedModel ? modelSupportsMaxEffort(focusedModel) : false;
  const focusedAvailableLevels = useMemo(() => {
    return focusedModel ? getAvailableEffortLevels(focusedModel) : [];
  }, [focusedModel]);
  const focusedDefaultEffort = useMemo(
    () => getDefaultEffortLevelForOption(focusedValue),
    [focusedValue],
  );

  const displayEffort = focusedAvailableLevels.includes(effort as EffortLevel)
    ? effort
    : focusedDefaultEffort;

  const handleFocus = useCallback(
    (value: string) => {
      const selectedValue = resolvePickerOptionValue(selectOptions, value) ?? value;
      setFocusedValue(selectedValue);
      if (!hasToggledEffort && effortValue === undefined) {
        setEffort(getDefaultEffortLevelForOption(selectedValue));
      }
    },
    [selectOptions, hasToggledEffort, effortValue],
  );

  const handleCycleEffort = useCallback(
    (direction: 'left' | 'right') => {
      if (!focusedSupportsEffort) {
        return;
      }
      setEffort(prev =>
        cycleEffortLevel(prev ?? focusedDefaultEffort, direction, focusedAvailableLevels),
      );
      setHasToggledEffort(true);
    },
    [focusedSupportsEffort, focusedDefaultEffort, focusedAvailableLevels],
  );

  const keybindingHandlers = useMemo(
    () => ({
      'modelPicker:decreaseEffort': () => handleCycleEffort('left'),
      'modelPicker:increaseEffort': () => handleCycleEffort('right'),
      ...(onRefresh ? { 'modelPicker:refresh': () => onRefresh() } : {}),
    }),
    [handleCycleEffort, onRefresh],
  );

  useKeybindings(keybindingHandlers, { context: 'ModelPicker' });

  const handleSelect = useCallback(
    (value: string) => {
      const selectedValue = resolvePickerOptionValue(selectOptions, value) ?? value;
      const selectedModel = resolveOptionModel(selectedValue);
      if (selectedValue !== NO_PREFERENCE && selectedModel && !isModelAllowed(selectedModel)) {
        onSelect(selectedValue === NO_PREFERENCE ? null : selectedValue, undefined);
        return;
      }
      // Clamp effort to a value in the focused model's available levels so
      // emitted/persisted values are always valid for the picked model
      // (e.g. toggled 'xhigh' then picked a model that doesn't support it).
      const clampedEffort = focusedAvailableLevels.includes(effort as EffortLevel)
        ? effort
        : focusedDefaultEffort;
      logEvent('tengu_model_command_menu_effort', {
        effort: clampedEffort as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      });
      if (!skipSettingsWrite) {
        const effortLevel = resolvePickerEffortPersistence(
          clampedEffort,
          getDefaultEffortLevelForOption(selectedValue),
          getSettingsForSource('userSettings')?.effortLevel,
          hasToggledEffort,
        );
        const persistable = toPersistableEffort(effortLevel);
        if (persistable !== undefined) {
          updateSettingsForSource('userSettings', { effortLevel: persistable });
        }
        setAppState(prev => ({
          ...prev,
          effortValue: effortLevel,
        }));
      }
      const selectedEffort =
        hasToggledEffort && selectedModel && modelSupportsEffort(selectedModel)
          ? clampedEffort
          : undefined;
      if (selectedValue === NO_PREFERENCE) {
        onSelect(null, selectedEffort);
        return;
      }
      // Thread the presented option's cross-profile marker (issue #1119) so the
      // /model command activates a provider only for a genuine switch option,
      // never for a literal custom id that merely starts with the prefix.
      // selectOptions is the actual presented list and its entries spread the
      // source ModelOption's `switchToProfileId`. If two options share the
      // selected value (a literal custom id colliding with an encoded switch
      // value), the selection is ambiguous — the Select cannot tell them apart —
      // so treat it as NOT a switch rather than letting the literal borrow
      // another option's marker.
      const selectedSwitchProfileId = resolveSelectedSwitchProfileId(selectOptions, selectedValue);
      onSelect(selectedValue, selectedEffort, selectedSwitchProfileId);
    },
    [
      effort,
      hasToggledEffort,
      onSelect,
      setAppState,
      skipSettingsWrite,
      focusedAvailableLevels,
      focusedDefaultEffort,
      selectOptions,
    ],
  );

  const visibleCount = Math.min(10, filteredOptions.length);
  const hiddenCount = Math.max(0, filteredOptions.length - visibleCount);

  const handleSearchInput = useCallback(
    (input: string) => {
      setSearchQuery(prev => prev + input);
    },
    [],
  );

  const handleSearchBackspace = useCallback(
    () => {
      setSearchQuery(prev => prev.slice(0, -1));
    },
    [],
  );

  const headerLine = headerText ??
    'Switch between Claude models. Applies to this session and future Nyxclaude sessions. For other/previous model names, specify with --model.';

  const refreshHint = onRefresh ? (
    <ConfigurableShortcutHint
      action="modelPicker:refresh"
      context="ModelPicker"
      fallback="r"
      description="refresh models"
    />
  ) : null;

  const discoveryLine = discoveryState ? (
    <Text color={mapDiscoveryToneToColor(discoveryState.tone)}>
      {discoveryState.message}
      {refreshHint ? <Text color="subtle"> {' '}· {refreshHint}</Text> : null}
    </Text>
  ) : refreshHint ? (
    <Text dimColor={true}>{refreshHint}</Text>
  ) : null;

  const searchLine = searchQuery ? (
    <Text dimColor={true}>Search: {searchQuery}</Text>
  ) : null;

  const content = (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text color="remember" bold={true}>Select model</Text>
        <Text dimColor={true}>{headerLine}</Text>
        {sessionModel && (
          <Text dimColor={true}>
            Currently using {modelDisplayString(sessionModel)} for this session (set by plan mode). Selecting a model will undo this.
          </Text>
        )}
        {discoveryLine}
        {searchLine}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="column">
          {filteredOptions.length > 0 ? (
            <Select
              defaultValue={initialFocusValue}
              defaultFocusValue={initialFocusValue}
              options={filteredOptions}
              onChange={handleSelect}
              onFocus={handleFocus}
              onCancel={
                searchQuery
                  ? () => setSearchQuery('')
                  : onCancel ?? (() => {})
              }
              visibleOptionCount={visibleCount}
              highlightText={searchQuery}
              onSearchInput={handleSearchInput}
              onSearchBackspace={handleSearchBackspace}
              disableSelection="numeric"
              hideIndexes
            />
          ) : (
            <Box paddingLeft={3} paddingY={1}>
              <Text dimColor={true}>
                No models match "{searchQuery}". Press Esc to clear.
              </Text>
            </Box>
          )}
        </Box>
        {hiddenCount > 0 && (
          <Box paddingLeft={3}>
            <Text dimColor={true}>and {hiddenCount} more…</Text>
          </Box>
        )}
      </Box>

      <Box marginBottom={1} flexDirection="column">
        {focusedSupportsEffort ? (
          <Text dimColor={true}>
            <EffortLevelIndicator effort={displayEffort as EffortLevel} />
            {' '}{capitalize(displayEffort as EffortLevel)} effort
            {displayEffort === focusedDefaultEffort ? ' (default)' : ''}
            {' '}<Text color="subtle">← → to adjust</Text>
          </Text>
        ) : (
          <Text color="subtle">
            <EffortLevelIndicator effort={undefined} />
            {' '}Effort not supported
            {focusedModelName ? ` for ${focusedModelName}` : ''}
          </Text>
        )}
      </Box>

      {isFastModeEnabled() ? (
        showFastModeNotice ? (
          <Box marginBottom={1}>
            <Text dimColor={true}>
              Fast mode is <Text bold={true}>ON</Text> and available with{' '}
              {FAST_MODE_MODEL_DISPLAY} only (/fast). Switching to other models turn off fast mode.
            </Text>
          </Box>
        ) : isFastModeAvailable() && !isFastModeCooldown() ? (
          <Box marginBottom={1}>
            <Text dimColor={true}>
              Use <Text bold={true}>/fast</Text> to turn on Fast mode ({FAST_MODE_MODEL_DISPLAY} only).
            </Text>
          </Box>
        ) : null
      ) : null}

      {isStandaloneCommand && (
        <Text dimColor={true} italic={true}>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : (
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              {refreshHint}
              <ConfigurableShortcutHint
                action="select:cancel"
                context="Select"
                fallback="Esc"
                description="exit"
              />
            </Byline>
          )}
        </Text>
      )}
    </Box>
  );

  if (!isStandaloneCommand) {
    return content;
  }

  return <Pane color="permission">{content}</Pane>;
}
