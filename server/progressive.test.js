import test from 'node:test';
import assert from 'node:assert/strict';
import { apiComparisons } from './test-fixtures.js';
import { profileQuestions, CATEGORY_ORDER } from './seed-data.js';
import { contextComparisons } from '../src/game/comparisonIndex.js';
import { buildInitialFlow, resolveCumulativeChoice } from '../src/game/gameUtils.js';
import { replayTournament } from './tournament.js';
test('progressive delivery supports each boundary, skip and stored-state reload with bounded payloads', () => {
  for (let seed=1; seed<=100; seed++) {
    let n=seed; const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
    let comparisons=contextComparisons(apiComparisons,'variables');
    let flow=buildInitialFlow(comparisons,profileQuestions,CATEGORY_ORDER,random), selectedStyles={};
    const choices=[];
    for(let currentIndex=0;currentIndex<flow.length;currentIndex++) {
      const step=flow[currentIndex]; if(step.type!=='code')continue;
      const skipped=random()<.2;
      const chosen=skipped || random()<.5 ? step.leftSnippet : step.rightSnippet;
      choices.push({comparison_id:step.id,round_number:choices.length+1,category:step.category,left_snippet_id:step.leftSnippet.id,right_snippet_id:step.rightSnippet.id,selected_snippet_id:skipped?null:chosen.id,skipped});
      const replay=replayTournament(apiComparisons,choices);
      const next=CATEGORY_ORDER[replay.categoryResults.length];
      const delivered=next?contextComparisons(apiComparisons,next,replay.carriedStyles):[];
      assert.ok(delivered.length<=6);
      comparisons=[...new Map([...comparisons,...delivered].map(c=>[c.id,c])).values()];
      const resolution=resolveCumulativeChoice({flow,currentIndex,selectedSnippet:chosen,comparisons,categoryOrder:CATEGORY_ORDER,selectedStyles,nextRoundNumber:choices.length+1,random});
      ({flow,selectedStyles}=resolution);
      // Simula uma atualização da página em cada passo, sem disponibilizar o conjunto de dados completo ao cliente.
      ({flow,selectedStyles,comparisons}=JSON.parse(JSON.stringify({flow,selectedStyles,comparisons})));
      assert.ok(JSON.stringify({flow,selectedStyles,comparisons}).length<150000);
    }
    assert.equal(choices.length,14);assert.equal(flow.length,19);
    assert.equal(replayTournament(apiComparisons,choices).complete,true);
  }
});

test('chosen block delimiters persist while every alternative in every later topic is still presented', async () => {
  const { cumulativeOptions } = await import('../src/game/cumulativeCode.js');
  for (const blocks of cumulativeOptions.blocks) {
    for (const seed of [1, 7, 29, 101]) {
      let state = seed;
      const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
      const favourites = Object.fromEntries(CATEGORY_ORDER.map(category => [category, cumulativeOptions[category].at(-1)]));
      favourites.blocks = blocks;
      let comparisons = contextComparisons(apiComparisons, CATEGORY_ORDER[0]);
      let flow = buildInitialFlow(comparisons, profileQuestions, CATEGORY_ORDER, random);
      let selectedStyles = {};
      const choices = [];
      const seen = Object.fromEntries(CATEGORY_ORDER.map(category => [category, new Set()]));
      for (let currentIndex = 0; currentIndex < flow.length; currentIndex++) {
        const step = flow[currentIndex];
        if (step.type !== 'code') continue;
        for (const snippet of [step.leftSnippet, step.rightSnippet]) {
          seen[step.category].add(snippet.style);
          assert.deepEqual(snippet.inherited_styles, selectedStyles);
          if (selectedStyles.blocks) {
            assert.equal(snippet.code.includes('{'), blocks === 'block_braces');
            assert.equal(/\bbegin\b/.test(snippet.code), blocks === 'block_begin_end');
            assert.equal(/\bend;/.test(snippet.code), blocks === 'block_begin_end');
            if (blocks === 'block_indent') assert.match(snippet.code, /:\n {2}/);
          }
        }
        const chosen = [step.leftSnippet, step.rightSnippet].find(s => s.style === favourites[step.category]) || step.rightSnippet;
        choices.push({ comparison_id: step.id, round_number: choices.length + 1, category: step.category,
          left_snippet_id: step.leftSnippet.id, right_snippet_id: step.rightSnippet.id,
          selected_snippet_id: chosen.id, skipped: false });
        const replay = replayTournament(apiComparisons, choices);
        const nextCategory = CATEGORY_ORDER[replay.categoryResults.length];
        const delivered = nextCategory ? contextComparisons(apiComparisons, nextCategory, replay.carriedStyles) : [];
        comparisons = [...new Map([...comparisons, ...delivered].map(c => [c.id, c])).values()];
        ({ flow, selectedStyles } = resolveCumulativeChoice({ flow, currentIndex, selectedSnippet: chosen,
          comparisons, categoryOrder: CATEGORY_ORDER, selectedStyles, nextRoundNumber: choices.length + 1, random }));
      }
      for (const category of CATEGORY_ORDER) assert.deepEqual(seen[category], new Set(cumulativeOptions[category]), `Missing alternative in ${category}`);
      assert.equal(choices.length, 14);
      assert.equal(flow.filter(step => step.type === 'profile').length, profileQuestions.length);
      const final = replayTournament(apiComparisons, choices);
      assert.equal(final.complete, true);
      assert.deepEqual(final.selectedStyles, favourites);
    }
  }
});
