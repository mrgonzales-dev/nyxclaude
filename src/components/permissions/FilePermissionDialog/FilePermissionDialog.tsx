import { relative } from 'path';
import React, { useMemo } from 'react';
import { Box, Text } from '../../../ink.js';
import type { ToolUseContext } from '../../../Tool.js';
import { getLanguageName } from '../../../utils/cliHighlight.js';
import { getCwd } from '../../../utils/cwd.js';
import { getFsImplementation, safeResolvePath } from '../../../utils/fsOperations.js';
import { expandPath } from '../../../utils/path.js';
import type { CompletionType } from '../../../utils/unaryLogging.js';
import { Select } from '../../CustomSelect/index.js';
import { usePermissionRequestLogging } from '../hooks.js';
import { PermissionScaffold } from '../PermissionScaffold.js';
import type { ToolUseConfirm } from '../PermissionRequest.js';
import type { WorkerBadgeProps } from '../WorkerBadge.js';
import { useDangerousModeConfirmation } from '../useDangerousModeConfirmation.js';
import type { FileOperationType, PermissionOption } from './permissionOptions.js';
import { type ToolInput, useFilePermissionDialog } from './useFilePermissionDialog.js';
export type FilePermissionDialogProps<T extends ToolInput = ToolInput> = {
  // Required props from PermissionRequestProps
  toolUseConfirm: ToolUseConfirm;
  toolUseContext: ToolUseContext;
  onDone: () => void;
  onReject: () => void;

  // Dialog customization
  title: string;
  subtitle?: React.ReactNode;
  question?: string | React.ReactNode;
  content?: React.ReactNode; // Can be general content or diff component

  // Logging
  completionType?: CompletionType;
  languageName?: string; // override — derived from path when omitted

  // File/directory operations
  path: string | null;
  parseInput: (input: unknown) => T;
  operationType?: FileOperationType;

  // Worker badge for teammate permission requests
  workerBadge: WorkerBadgeProps | undefined;
};
export function FilePermissionDialog<T extends ToolInput = ToolInput>({
  toolUseConfirm,
  onDone,
  onReject,
  title,
  subtitle,
  question = 'Do you want to proceed?',
  content,
  completionType = 'tool_use_single',
  path,
  parseInput,
  operationType = 'write',
  workerBadge,
  languageName: languageNameOverride
}: FilePermissionDialogProps<T>): React.ReactNode {
  // Derive from path unless caller provided an explicit override (NotebookEdit
  // passes 'python'/'markdown' from cell_type). getLanguageName is async;
  // downstream UnaryEvent.language_name and logPermissionEvent already accept
  // Promise<string>. useMemo keeps the promise stable across renders.
  const languageName = useMemo(() => languageNameOverride ?? (path ? getLanguageName(path) : 'none'), [languageNameOverride, path]);
  const unaryEvent = useMemo(() => ({
    completion_type: completionType,
    language_name: languageName
  }), [completionType, languageName]);
  usePermissionRequestLogging(toolUseConfirm, unaryEvent);
  const symlinkTarget = useMemo(() => {
    if (!path || operationType === 'read') {
      return null;
    }
    const expandedPath = expandPath(path);
    const fs = getFsImplementation();
    const {
      resolvedPath,
      isSymlink
    } = safeResolvePath(fs, expandedPath);
    if (isSymlink) {
      return resolvedPath;
    }
    return null;
  }, [path, operationType]);
  const fileDialogResult = useFilePermissionDialog({
    filePath: path || '',
    completionType,
    languageName,
    toolUseConfirm,
    onDone,
    onReject,
    parseInput,
    operationType
  });

  // Use file dialog results for options
  const {
    options,
    acceptFeedback,
    rejectFeedback,
    setFocusedOption,
    handleInputModeToggle,
    focusedOption,
    yesInputMode,
    noInputMode
  } = fileDialogResult;

  // Parse input using the provided parser
  const parsedInput = parseInput(toolUseConfirm.input);
  const {
    confirmDangerousMode,
    dangerousModeDialog
  } = useDangerousModeConfirmation();
  const onChange = (option_0: PermissionOption, feedback?: string) => {
    if (option_0.type === 'accept-full-access') {
      confirmDangerousMode('fullAccess', () => {
        fileDialogResult.onChange(option_0, parsedInput, feedback?.trim());
      });
      return;
    }
    fileDialogResult.onChange(option_0, parsedInput, feedback?.trim());
  };
  if (dangerousModeDialog) {
    return dangerousModeDialog;
  }
  const isSymlinkOutsideCwd = symlinkTarget != null && relative(getCwd(), symlinkTarget).startsWith('..');
  const symlinkWarning = symlinkTarget ? <Box paddingX={1} marginBottom={1}>
      <Text color="warning">
        {isSymlinkOutsideCwd ? `This will modify ${symlinkTarget} (outside working directory) via a symlink` : `Symlink target: ${symlinkTarget}`}
      </Text>
    </Box> : null;
  return <>
      <PermissionScaffold title={title} subtitle={subtitle} innerPaddingX={0} workerBadge={workerBadge} permissionResult={toolUseConfirm.permissionResult} toolType={operationType === 'read' ? 'read' : 'edit'}>
        {symlinkWarning}
        {content}
        <Box flexDirection="column" paddingX={1}>
          {typeof question === 'string' ? <Text>{question}</Text> : question}
          <Select options={options} inlineDescriptions onChange={value => {
          const selected = options.find(opt => opt.value === value);
          if (selected) {
            // For reject option
            if (selected.option.type === 'reject') {
              const trimmedFeedback = selected.option.withReason || noInputMode ? rejectFeedback.trim() : '';
              if (selected.option.withReason && !trimmedFeedback) {
                return;
              }
              onChange(selected.option, trimmedFeedback || undefined);
              return;
            }
            // For accept-once option, pass accept feedback if present
            if (selected.option.type === 'accept-once') {
              const trimmedFeedback_0 = acceptFeedback.trim();
              onChange(selected.option, trimmedFeedback_0 || undefined);
              return;
            }
            onChange(selected.option);
          }
        }} onCancel={() => onChange({
          type: 'reject'
        })} onFocus={value_0 => setFocusedOption(value_0)} onInputModeToggle={handleInputModeToggle} onEmptyInputSubmit={value_1 => {
          if (value_1 !== 'no-with-reason') {
            onChange({
              type: 'reject'
            });
          }
        }} />
        </Box>
      </PermissionScaffold>
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>
          Esc to cancel
          {(focusedOption === 'yes' && !yesInputMode || focusedOption === 'no' && !noInputMode) && ' · Tab to amend'}
        </Text>
      </Box>
    </>;
}
