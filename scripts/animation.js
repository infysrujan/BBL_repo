/*
 * AI Generated & Modified by Satarupa Das
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env browser */

const DEFAULT_DURATION = 300;
const DEFAULT_EASING = 'ease';

/**
 * Normalizes options for slide animations.
 * @param {Object} [options]
 * @param {number} [options.duration]
 * @param {string} [options.easing]
 * @param {function} [options.onComplete]
 * @returns {{ duration: number, easing: string, onComplete: function|undefined }}
 */
function normalizeOptions(options = {}) {
  return {
    duration: options.duration ?? DEFAULT_DURATION,
    easing: options.easing ?? DEFAULT_EASING,
    onComplete: options.onComplete,
  };
}

/**
 * Animates an element from collapsed to visible by animating maxHeight from 0 to scrollHeight.
 * Requires overflow: hidden on the element (or set during animation) for a clean reveal.
 * @param {Element} element
 * @param {Object} [options] - { duration, easing, onComplete }
 * @returns {Animation}
 */
export function slideDown(element, options = {}) {
  const { duration, easing, onComplete } = normalizeOptions(options);
  const prevOverflow = element.style.overflow;
  element.style.overflow = 'hidden';
  element.style.maxHeight = 'none';
  const endHeight = element.scrollHeight;
  element.style.maxHeight = '0';
  const animation = element.animate(
    [
      { maxHeight: '0px' },
      { maxHeight: `${endHeight}px` },
    ],
    { duration, easing, fill: 'forwards' },
  );
  animation.finished.then(() => {
    animation.cancel();
    element.style.maxHeight = 'none';
    element.style.overflow = prevOverflow || '';
  });
  if (typeof onComplete === 'function') {
    animation.finished.then(onComplete);
  }
  return animation;
}

/**
 * Animates an element from visible to collapsed by animating maxHeight from scrollHeight to 0.
 * @param {Element} element
 * @param {Object} [options] - { duration, easing, onComplete }
 * @returns {Animation}
 */
export function slideUp(element, options = {}) {
  const { duration, easing, onComplete } = normalizeOptions(options);
  const prevOverflow = element.style.overflow;
  element.style.overflow = 'hidden';
  const startHeight = element.scrollHeight;
  const animation = element.animate(
    [
      { maxHeight: `${startHeight}px` },
      { maxHeight: '0px' },
    ],
    { duration, easing, fill: 'forwards' },
  );
  animation.finished.then(() => {
    animation.cancel();
    element.style.maxHeight = 'none';
    element.style.overflow = prevOverflow || '';
  });
  if (typeof onComplete === 'function') {
    animation.finished.then(onComplete);
  }
  return animation;
}

/**
 * Animates an element from visible to collapsed by animating maxWidth from scrollWidth to 0.
 * @param {Element} element
 * @param {Object} [options] - { duration, easing, onComplete }
 * @returns {Animation}
 */
export function slideLeft(element, options = {}) {
  const { duration, easing, onComplete } = normalizeOptions(options);
  const prevOverflow = element.style.overflow;
  element.style.overflow = 'hidden';
  const startWidth = element.scrollWidth;
  const animation = element.animate(
    [
      { maxWidth: `${startWidth}px` },
      { maxWidth: '0px' },
    ],
    { duration, easing, fill: 'forwards' },
  );
  animation.finished.then(() => {
    animation.cancel();
    element.style.maxWidth = 'none';
    element.style.overflow = prevOverflow || '';
  });
  if (typeof onComplete === 'function') {
    animation.finished.then(onComplete);
  }
  return animation;
}

/**
 * Animates an element from collapsed to visible by animating maxWidth from 0 to scrollWidth.
 * @param {Element} element
 * @param {Object} [options] - { duration, easing, onComplete }
 * @returns {Animation}
 */
export function slideRight(element, options = {}) {
  const { duration, easing, onComplete } = normalizeOptions(options);
  const prevOverflow = element.style.overflow;
  element.style.overflow = 'hidden';
  element.style.maxWidth = 'none';
  const endWidth = element.scrollWidth;
  element.style.maxWidth = '0';
  const animation = element.animate(
    [
      { maxWidth: '0px' },
      { maxWidth: `${endWidth}px` },
    ],
    { duration, easing, fill: 'forwards' },
  );
  animation.finished.then(() => {
    animation.cancel();
    element.style.maxWidth = 'none';
    element.style.overflow = prevOverflow || '';
  });
  if (typeof onComplete === 'function') {
    animation.finished.then(onComplete);
  }
  return animation;
}
