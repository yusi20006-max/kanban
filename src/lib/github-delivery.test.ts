import test from "node:test";
import assert from "node:assert/strict";
test("Phase 9 branch identity is deterministic",()=>{const cardId="1234567890abcdef";assert.equal(`kanban/card-${cardId.slice(0,12)}`,"kanban/card-1234567890ab");});
test("Phase 9 CI identity is keyed by run and head SHA",()=>{const key=(repo:string,runId:number,sha:string)=>`github-ci-failure:${repo}:${runId}:${sha}`;assert.equal(key("owner/repo",42,"abc"),"github-ci-failure:owner/repo:42:abc");});
