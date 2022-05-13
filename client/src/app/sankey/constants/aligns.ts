// Copyright 2015, Mike Bostock
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification,
// are permitted provided that the following conditions are met:
//
// * Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
//
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
//
// * Neither the name of the author nor the names of contributors may be used to
//   endorse or promote products derived from this software without specific prior
//   written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
// ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { min } from 'd3-array';

import { isNotEmpty } from 'app/shared/utils';

import { ALIGNS, ALIGN_ID } from '../interfaces/align';

function targetDepth(d) {
  return d.target.depth;
}

function left(node) {
  return node.depth;
}

function right(node, n) {
  return n - 1 - node.reversedDepth;
}

function justify(node, n) {
  return isNotEmpty(node.sourceLinks) ? node.depth : n - 1;
}

function center(node) {
  return isNotEmpty(node.targetLinks) ? node.depth
    : isNotEmpty(node.sourceLinks) ? (min(node.sourceLinks, targetDepth) as any) - 1
      : 0;
}

export const aligns: ALIGNS = {
  [ALIGN_ID.left]: {
    name: 'left',
    description: 'Align nodes to the left',
    fn: left,
  },
  [ALIGN_ID.right]: {
    name: 'right',
    description: 'Align nodes to the right',
    fn: right,
  },
  [ALIGN_ID.center]: {
    name: 'center',
    description: 'Align nodes to the center',
    fn: center,
  },
  [ALIGN_ID.justify]: {
    name: 'justify',
    description: 'Justify nodes',
    fn: justify,
  },
};
