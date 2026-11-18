// Tests de scripts/audit-check.mjs: node --test scripts/audit-check.test.mjs
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALLOWED_ADVISORIES, checkAudit, listAdvisories } from './audit-check.mjs';

const ALLOWED = {
  id: 'GHSA-aaaa-bbbb-cccc',
  project: 'backend',
  packageName: 'picomatch',
  range: '<=4.0.7',
  reason: 'test',
  reviewBy: '2026-12-18',
};

function advisory(id, packageName, { severity = 'high', range = '<=4.0.7' } = {}) {
  return {
    name: packageName,
    url: `https://github.com/advisories/${id}`,
    title: `${packageName} is vulnerable`,
    severity,
    range,
  };
}

// Un informe de npm audit: los avisos de un paquete van juntos en su `via`, y
// otro paquete solo depende de él
function report(vias, fixAvailable = { name: 'typeorm', version: '0.3.31', isSemVerMajor: true }) {
  const vulnerabilities = {};
  for (const via of vias) {
    vulnerabilities[via.name] ??= { name: via.name, severity: via.severity, via: [], fixAvailable };
    vulnerabilities[via.name].via.push(via);
  }
  vulnerabilities.tinyglobby = {
    name: 'tinyglobby',
    severity: 'high',
    via: ['picomatch'],
    fixAvailable,
  };
  return { auditReportVersion: 2, vulnerabilities };
}

const check = (auditReport, options = {}) =>
  checkAudit({
    report: auditReport,
    project: 'backend',
    today: '2026-11-18',
    allowlist: [ALLOWED],
    ...options,
  });

describe('audit-check', () => {
  it('passes with no high or critical advisory, ignoring moderate ones', () => {
    const result = check(report([advisory('GHSA-mmmm', 'glob', { severity: 'moderate' })]), {
      allowlist: [],
    });
    assert.deepEqual(result, { problems: [], allowed: [] });
  });

  it('fails with any high or critical advisory that is not allowed', () => {
    const { problems } = check(
      report([advisory('GHSA-zzzz', 'lodash', { severity: 'critical' })]),
      { allowlist: [] },
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^Not allowed: GHSA-zzzz \(lodash/);
  });

  it('allows only the listed advisory, of that package, and says so', () => {
    const { problems, allowed } = check(report([advisory(ALLOWED.id, 'picomatch')]));
    assert.deepEqual(problems, []);
    assert.equal(allowed.length, 1);
    assert.match(allowed[0], /GHSA-aaaa-bbbb-cccc \(picomatch <=4.0.7, high\).*until 2026-12-18/);
  });

  it('does not let another advisory of the same package through', () => {
    const { problems } = check(
      report([advisory(ALLOWED.id, 'picomatch'), advisory('GHSA-other', 'picomatch')]),
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /^Not allowed: GHSA-other/);
  });

  it('does not let the same advisory through in another package or project', () => {
    assert.match(check(report([advisory(ALLOWED.id, 'micromatch')])).problems[0], /^Not allowed/);
    const { problems } = check(report([advisory(ALLOWED.id, 'picomatch')]), {
      project: 'frontend',
    });
    assert.match(problems[0], /^Not allowed/);
  });

  it('fails once the review date has passed', () => {
    const { problems } = check(report([advisory(ALLOWED.id, 'picomatch')]), {
      today: '2026-12-19',
    });
    assert.match(problems[0], /^Exception expired on 2026-12-18/);
  });

  it('fails when the advisory range changes, since a fix may exist', () => {
    const { problems } = check(report([advisory(ALLOWED.id, 'picomatch', { range: '<4.0.8' })]));
    assert.match(problems[0], /^Advisory changed from <=4.0.7 to <4.0.8/);
  });

  it('fails when npm offers a compatible fix', () => {
    const withMinorFix = report([advisory(ALLOWED.id, 'picomatch')], {
      name: 'typeorm',
      version: '0.4.1',
      isSemVerMajor: false,
    });
    assert.match(check(withMinorFix).problems[0], /^A compatible fix exists/);
    assert.match(
      check(report([advisory(ALLOWED.id, 'picomatch')], true)).problems[0],
      /fix exists/,
    );
  });

  it('fails when an exception is no longer needed', () => {
    const { problems } = check(report([]));
    assert.match(problems[0], /^Exception no longer needed.*GHSA-aaaa-bbbb-cccc/);
  });

  it('fails when npm audit does not return a report', () => {
    const { problems } = check({ error: { code: 'ENOTFOUND' } });
    assert.match(problems[0], /^npm audit did not return a report.*ENOTFOUND/);
  });

  it('lists each advisory once, not the packages that only depend on it', () => {
    const advisories = listAdvisories(report([advisory(ALLOWED.id, 'picomatch')]));
    assert.deepEqual(
      advisories.map(({ id, packageName }) => `${id}:${packageName}`),
      ['GHSA-aaaa-bbbb-cccc:picomatch'],
    );
  });

  it('keeps every real exception justified and reviewed within a month', () => {
    for (const entry of ALLOWED_ADVISORIES) {
      assert.match(entry.id, /^GHSA-[\w-]+$/);
      assert.ok(['backend', 'frontend'].includes(entry.project));
      assert.ok(entry.packageName && entry.range && entry.reason);
      assert.match(entry.reviewBy, /^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
