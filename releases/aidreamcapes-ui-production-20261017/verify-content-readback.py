import copy,json
from pathlib import Path
p=Path(__file__).parent
before=json.loads((p/'production-before.json').read_text())
after=json.loads((p/'production-after.json').read_text())
manifest=json.loads((p/'content-manifest.json').read_text())
expected={row['id']:copy.deepcopy(row['contentJson']) for row in before['pages']}
actual={row['id']:row['contentJson'] for row in after['pages']}
for op in manifest['operations']:
    assert op['entityType']=='live_page' and op['field']=='contentJson'
    path=[x.replace('~1','/').replace('~0','~') for x in op['path'].split('/')[1:]]
    value=expected[op['id']]
    for key in path[:-1]:
        value=value[int(key)] if isinstance(value,list) else value[key]
    key=path[-1]
    if isinstance(value,list):value[int(key)]=op['value']
    else:value[key]=op['value']
assert expected.keys()==actual.keys(),'Page set changed'
mismatches=[key for key in expected if expected[key]!=actual[key]]
assert not mismatches,f'Unexpected content differences: {mismatches}'
assert before['otherSitesHash']==after['otherSitesHash'],'Other storefront content changed'
assert before['pricesHash']==after['pricesHash'],'Aidreamcapes prices changed'
report={'ok':True,'pagesCompared':len(expected),'exactManifestOperations':len(manifest['operations']),'changedPages':len({x['id'] for x in manifest['operations']}),'unrelatedFieldsPreserved':True,'otherStorefrontsUnchanged':True,'pricesUnchanged':True,'codeCommit':manifest['codeCommit']}
(p/'content-readback-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
