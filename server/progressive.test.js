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
      // Simulate a reload at every step, with no full dataset available to the client.
      ({flow,selectedStyles,comparisons}=JSON.parse(JSON.stringify({flow,selectedStyles,comparisons})));
      assert.ok(JSON.stringify({flow,selectedStyles,comparisons}).length<150000);
    }
    assert.equal(choices.length,14);assert.equal(flow.length,19);
    assert.equal(replayTournament(apiComparisons,choices).complete,true);
  }
});
