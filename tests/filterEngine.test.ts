import { describe, it, expect } from 'vitest';
import { isMatch, findMatchedKeyword } from '../src/main/filterEngine';
import { FilterConfig } from '../src/shared/types';

describe('filterEngine - isMatch()', () => {
  const baseConfig: FilterConfig = {
    sourceFolder: '/src',
    destFolder: '/dst',
    recursive: false,
    keywords_include: ['dsc', 'a7r'],
    keywords_exclude: ['wa', 'edit'],
    match_type: 'contains',
    extensions: ['.jpg', '.arw'],
    mode: 'copy',
    duplicate_policy: 'auto_rename',
    allow_overwrite: false,
    auto_subfolder: 'none',
  };

  it('matches valid include keyword and extension case-insensitively', () => {
    expect(isMatch('DSC0001.JPG', baseConfig)).toBe(true);
    expect(isMatch('a7r_photo.arw', baseConfig)).toBe(true);
  });

  it('accepts all valid photo extensions when config.extensions is empty []', () => {
    const configEmptyExt: FilterConfig = {
      ...baseConfig,
      extensions: [],
    };
    expect(isMatch('DSC0001.JPG', configEmptyExt)).toBe(true);
    expect(isMatch('DSC0001.CR3', configEmptyExt)).toBe(true);
    expect(isMatch('DSC0001.NEF', configEmptyExt)).toBe(true);
  });

  it('rejects files with non-selected extension when extensions array is specified', () => {
    expect(isMatch('DSC0001.PNG', baseConfig)).toBe(false);
  });

  it('strictly rejects all video files regardless of keywords or empty extensions config', () => {
    const configEmptyExt: FilterConfig = {
      ...baseConfig,
      extensions: [],
    };
    expect(isMatch('DSC0001.MP4', configEmptyExt)).toBe(false);
    expect(isMatch('DSC0001.MOV', configEmptyExt)).toBe(false);
    expect(isMatch('video_clip.avi', configEmptyExt)).toBe(false);
    expect(isMatch('DSC0001.JPG', configEmptyExt)).toBe(true);
  });

  it('rejects files matching exclude keyword even if include matches', () => {
    expect(isMatch('DSC0001_WA.JPG', baseConfig)).toBe(false);
    expect(isMatch('a7r_edit.arw', baseConfig)).toBe(false);
  });

  it('requires keywords_include: returns false (0 matched) when no keywords are typed/pasted', () => {
    const configNoInclude: FilterConfig = {
      ...baseConfig,
      keywords_include: [],
    };
    expect(isMatch('random_name.jpg', configNoInclude)).toBe(false);
    expect(isMatch('random_name.arw', configNoInclude)).toBe(false);
  });

  it('handles starts_with match_type correctly', () => {
    const configStartsWith: FilterConfig = {
      ...baseConfig,
      keywords_include: ['dsc'],
      match_type: 'starts_with',
    };
    expect(isMatch('DSC_001.jpg', configStartsWith)).toBe(true);
    expect(isMatch('my_DSC_001.jpg', configStartsWith)).toBe(false);
  });
});

describe('filterEngine - findMatchedKeyword()', () => {
  const config: FilterConfig = {
    sourceFolder: '',
    destFolder: '',
    recursive: false,
    keywords_include: ['A7R', 'DSC'],
    keywords_exclude: [],
    match_type: 'contains',
    extensions: ['.jpg'],
    mode: 'copy',
    duplicate_policy: 'auto_rename',
    allow_overwrite: false,
    auto_subfolder: 'none',
  };

  it('finds matched keyword from include list', () => {
    expect(findMatchedKeyword('DSC001.jpg', config)).toBe('DSC');
    expect(findMatchedKeyword('Photo_A7R_01.jpg', config)).toBe('A7R');
  });
});
