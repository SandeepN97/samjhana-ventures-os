import json, os, subprocess, sys
dir_, out, tests, spec = sys.argv[1:5]
muts = json.load(open(spec))
os.makedirs(out, exist_ok=True)
summary = open(os.path.join(out, 'summary.txt'), 'w')
env = dict(os.environ, SPRING_PROFILES_ACTIVE='test')
for m in muts:
    path = os.path.join(dir_, m['file'])
    orig = open(path).read()
    if orig.count(m['old']) != 1:
        summary.write(f"{m['name']}: SETUP-ERROR (target found {orig.count(m['old'])} times)\n"); summary.flush(); continue
    open(path, 'w').write(orig.replace(m['old'], m['new']))
    try:
        r = subprocess.run(['mvn', '-B', '-q', 'test', '-Pdev', '-Dtest=' + m.get('tests', tests)], cwd=dir_, env=env,
                           stdout=open(os.path.join(out, m['name'] + '.log'), 'w'), stderr=subprocess.STDOUT)
    finally:
        open(path, 'w').write(orig)
    summary.write(f"{m['name']}: {'CAUGHT' if r.returncode != 0 else 'SURVIVED (no test failed!)'}\n"); summary.flush()
summary.write('DONE\n'); summary.close()
