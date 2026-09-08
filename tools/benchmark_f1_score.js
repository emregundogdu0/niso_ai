/**
 * NISO AI - F1-Score Benchmark & Evaluation Runner
 * Evaluates intent routing and classification performance against the ground truth dataset.
 * Computes Confusion Matrix, Precision, Recall, and F1-Score per class, plus Macro/Weighted F1.
 */

const fs = require('fs');
const path = require('path');
const { preRouteGuard } = require('./pre_router_guard');

const DATASET_PATH = path.resolve(__dirname, '../benchmark/niso_f1_benchmark.json');

async function runF1Benchmark() {
  if (!fs.existsSync(DATASET_PATH)) {
    console.error('Dataset not found at:', DATASET_PATH);
    process.exit(1);
  }

  const testCases = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));

  console.log('========================================================================');
  console.log('         NISO AI — INTENT CLASSIFICATION F1-SCORE BENCHMARK             ');
  console.log('========================================================================');
  console.log(`Dataset: ${testCases.length} Ground Truth Test Cases\n`);

  const classes = [
    'ATTENDANCE_SQL',
    'PROJECT_MAIL',
    'HR_POLICY',
    'COMPANY_KNOWLEDGE',
    'SMALL_TALK',
    'SECURITY_REJECTED',
    'HYBRID'
  ];

  // Confusion matrix: [actual][predicted]
  const matrix = {};
  for (const a of classes) {
    matrix[a] = {};
    for (const p of classes) {
      matrix[a][p] = 0;
    }
  }

  const results = [];
  let correctTotal = 0;

  for (const tc of testCases) {
    const routeRes = preRouteGuard(tc.question);
    const predicted = routeRes.intent;
    const actual = tc.expected_intent;

    if (matrix[actual] && matrix[actual][predicted] !== undefined) {
      matrix[actual][predicted]++;
    }

    const isMatch = predicted === actual;
    if (isMatch) correctTotal++;

    results.push({
      id: tc.id,
      question: tc.question,
      actual,
      predicted,
      confidence: routeRes.intent_confidence,
      match: isMatch
    });
  }

  // Calculate Precision, Recall, F1 for each class
  const metrics = {};
  let macroPrecision = 0;
  let macroRecall = 0;
  let macroF1 = 0;

  for (const c of classes) {
    let tp = matrix[c][c];
    let fp = 0;
    let fn = 0;

    for (const other of classes) {
      if (other !== c) {
        fp += matrix[other][c];
        fn += matrix[c][other];
      }
    }

    const precision = (tp + fp) > 0 ? (tp / (tp + fp)) : 0;
    const recall = (tp + fn) > 0 ? (tp / (tp + fn)) : 0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall / (precision + recall)) : 0;
    const support = tp + fn;

    metrics[c] = {
      tp, fp, fn, support,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4))
    };

    macroPrecision += precision;
    macroRecall += recall;
    macroF1 += f1;
  }

  macroPrecision /= classes.length;
  macroRecall /= classes.length;
  macroF1 /= classes.length;
  const overallAccuracy = correctTotal / testCases.length;

  // Print Formatted Results Table
  console.log('| Intent Class          | Support | TP | FP | FN | Precision |  Recall  | F1-Score |');
  console.log('| :-------------------- | :-----: | :-: | :-: | :-: | :-------: | :------: | :------: |');
  for (const c of classes) {
    const m = metrics[c];
    const padClass = c.padEnd(21, ' ');
    const padSup = String(m.support).padStart(3, ' ');
    const padTp = String(m.tp).padStart(2, ' ');
    const padFp = String(m.fp).padStart(2, ' ');
    const padFn = String(m.fn).padStart(2, ' ');
    const pStr = (m.precision * 100).toFixed(1) + '%';
    const rStr = (m.recall * 100).toFixed(1) + '%';
    const fStr = (m.f1 * 100).toFixed(1) + '%';
    console.log(`| ${padClass} |   ${padSup}   | ${padTp} | ${padFp} | ${padFn} |   ${pStr.padStart(6, ' ')}  |  ${rStr.padStart(6, ' ')}  |  ${fStr.padStart(6, ' ')}  |`);
  }
  console.log('------------------------------------------------------------------------');
  console.log(`Overall Accuracy:   ${(overallAccuracy * 100).toFixed(2)}% (${correctTotal}/${testCases.length})`);
  console.log(`Macro Precision:    ${(macroPrecision * 100).toFixed(2)}%`);
  console.log(`Macro Recall:       ${(macroRecall * 100).toFixed(2)}%`);
  console.log(`Macro F1-Score:     ${(macroF1 * 100).toFixed(2)}%`);
  console.log('========================================================================\n');

  // Print any mismatched cases if present
  const mismatches = results.filter(r => !r.match);
  if (mismatches.length > 0) {
    console.log('⚠️ Mismatched Cases:');
    for (const m of mismatches) {
      console.log(`- [${m.id}] "${m.question}" => Predicted: ${m.predicted}, Expected: ${m.actual}`);
    }
  } else {
    console.log('🎉 100% PERFECT SCORE: Zero misclassifications across all test cases!');
  }
}

runF1Benchmark().catch(console.error);
