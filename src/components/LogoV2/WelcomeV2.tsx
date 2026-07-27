import React from 'react';
import { Box, Text, useTheme } from '../../ink.js';
import { WORDMARK } from '../../constants/brand.js';

export function WelcomeV2() {
  const [theme] = useTheme();
  return (
    <Box marginTop={1} flexDirection="column" alignItems="center">
      {WORDMARK.map((line, i) => (
        <Text key={i} color="brandShimmer">{line}</Text>
      ))}
      <Text dimColor> AI harness · omniroute </Text>
    </Box>
  );
}
