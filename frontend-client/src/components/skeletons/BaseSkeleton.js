import React, { memo } from 'react';
import { View } from 'react-native';
import { Skeleton } from 'moti/skeleton';
import { theme } from '../../constants/theme';

const defaultColors = [theme.surface, theme.surfaceLight, theme.surface];

export const SkeletonBox = memo(({ 
  width, 
  height, 
  radius = 8, 
  colorMode = 'dark',
  colors = defaultColors,
  style,
  show = true
}) => {
  return (
    <Skeleton
      show={show}
      colorMode={colorMode}
      colors={colors}
      width={width}
      height={height}
      radius={radius}
    />
  );
});

export const SkeletonCircle = memo(({ 
  size, 
  colorMode = 'dark',
  colors = defaultColors,
  style,
  show = true
}) => {
  return (
    <Skeleton
      show={show}
      colorMode={colorMode}
      colors={colors}
      width={size}
      height={size}
      radius="round"
    />
  );
});
