const segmentCharacters = (value) => Array.from(String(value ?? '').normalize('NFC'));
const segmentWords = (value) => String(value ?? '').normalize('NFC').match(/\S+/gu) || [];

function tokenizeText(value) {
  const pieces = String(value ?? '').normalize('NFC').replace(/\r\n?/g, '\n').match(/\s+|\S+/gu) || [];
  const words = []; let separator = '';
  for (const piece of pieces) {
    if (/^\s+$/u.test(piece)) separator += piece;
    else { words.push({ text: piece, before: separator }); separator = ''; }
  }
  return { words, trailing: separator };
}

function buildWordAlignment(sourceValue, typedValue) {
  const source = tokenizeText(sourceValue); const typed = tokenizeText(typedValue);
  const rows = source.words.length + 1; const columns = typed.words.length + 1;
  const width = columns; const costs = new Uint32Array(rows * columns); const exact = new Uint32Array(rows * columns); const directions = new Uint8Array(rows * columns);
  for (let i = 1; i < rows; i += 1) { costs[i * width] = i; directions[i * width] = 2; }
  for (let j = 1; j < columns; j += 1) { costs[j] = j; directions[j] = 3; }
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      const index = i * width + j; const same = source.words[i - 1].text === typed.words[j - 1].text;
      const diagonalCost = costs[(i - 1) * width + j - 1] + (same ? 0 : 1);
      const deletionCost = costs[(i - 1) * width + j] + 1; const insertionCost = costs[i * width + j - 1] + 1;
      const diagonalExact = exact[(i - 1) * width + j - 1] + (same ? 1 : 0);
      const deletionExact = exact[(i - 1) * width + j]; const insertionExact = exact[i * width + j - 1];
      const preferredDirection = j > i ? 3 : i > j ? 2 : 1;
      const choices = [
        { direction: 1, cost: diagonalCost, exact: diagonalExact, rank: same && preferredDirection === 1 ? 0 : 2 },
        { direction: 2, cost: deletionCost, exact: deletionExact, rank: preferredDirection === 2 ? 0 : 1 },
        { direction: 3, cost: insertionCost, exact: insertionExact, rank: preferredDirection === 3 ? 0 : 1 }
      ];
      choices.sort((left, right) => left.cost - right.cost || right.exact - left.exact || left.rank - right.rank || left.direction - right.direction);
      costs[index] = choices[0].cost; exact[index] = choices[0].exact; directions[index] = choices[0].direction;
    }
  }
  const reversed = []; let i = source.words.length; let j = typed.words.length;
  while (i || j) {
    const direction = directions[i * width + j];
    if (direction === 1) reversed.push({ source: source.words[--i], typed: typed.words[--j], type: source.words[i].text === typed.words[j].text ? 'match' : 'substitute' });
    else if (direction === 2 || j === 0) reversed.push({ source: source.words[--i], typed: null, type: 'delete' });
    else reversed.push({ source: null, typed: typed.words[--j], type: 'insert' });
  }
  return { nodes: reversed.reverse(), sourceTrailing: source.trailing, typedTrailing: typed.trailing, referenceWords: source.words.length, typedWords: typed.words.length, distance: costs.at(-1) };
}

export function alignWords(source, typed) {
  const alignment = buildWordAlignment(source, typed);
  const wrongWords = alignment.nodes.filter((node) => node.type === 'substitute').length;
  const omittedWords = alignment.nodes.filter((node) => node.type === 'delete').length;
  const extraWords = alignment.nodes.filter((node) => node.type === 'insert').length;
  return { typedWords: alignment.typedWords, referenceWords: alignment.referenceWords, wrongWords, omittedWords, extraWords, totalWordErrors: alignment.distance };
}

/**
 * Computes a Unicode code-point edit alignment using rolling rows.
 * Substitution = wrong, target deletion = omitted, input insertion = extra.
 */
export function alignCharacters(source, typed) {
  const target = segmentCharacters(source);
  const input = segmentCharacters(typed);
  const maximumBand = Math.max(target.length, input.length);
  let band = Math.min(maximumBand, Math.max(32, Math.abs(target.length - input.length) + 16));
  let alignment;
  do {
    alignment = alignWithinBand(target, input, band);
    if (alignment.totalErrors <= band || band >= maximumBand) break;
    band = Math.min(maximumBand, band * 2);
  } while (true);
  return { ...alignment, referenceCharacters: target.length, typedCharacters: input.length };
}

const isWhitespace = (value) => /\s/u.test(value);
const isLineBreak = (value) => value === '\n' || value === '\r';
const isPunctuation = (value) => /[\p{P}\p{S}]/u.test(value);
const isLetter = (value) => /\p{L}/u.test(value);

/**
 * Builds the canonical, character-level edit script used for both scoring and UI.
 * Costs are computed with rolling rows; only one byte per cell is retained for
 * backtracking, keeping normal exam passages comfortably bounded in memory.
 */
const emptyCounts = () => ({ omission: 0, addition: 0, spelling: 0, substitution: 0, repetition: 0, incompleteWord: 0, spacing: 0, capitalization: 0, punctuation: 0, transposition: 0, paragraphic: 0 });
const halfCategories = new Set(['spacing', 'capitalization', 'punctuation', 'transposition', 'paragraphic']);

function localCharacterAlignment(sourceValue, typedValue) {
  const source = segmentCharacters(sourceValue); const typed = segmentCharacters(typedValue); const width = typed.length + 1;
  const costs = new Uint32Array((source.length + 1) * width); const directions = new Uint8Array((source.length + 1) * width);
  for (let i = 1; i <= source.length; i += 1) { costs[i * width] = i; directions[i * width] = 2; }
  for (let j = 1; j <= typed.length; j += 1) { costs[j] = j; directions[j] = 3; }
  for (let i = 1; i <= source.length; i += 1) for (let j = 1; j <= typed.length; j += 1) {
    const index = i * width + j;
    if (source[i - 1] === typed[j - 1]) { costs[index] = costs[(i - 1) * width + j - 1]; directions[index] = 1; continue; }
    const substitution = costs[(i - 1) * width + j - 1] + 1; const deletion = costs[(i - 1) * width + j] + 1; const insertion = costs[i * width + j - 1] + 1;
    if (substitution <= deletion && substitution <= insertion) { costs[index] = substitution; directions[index] = 4; }
    else if (deletion <= insertion) { costs[index] = deletion; directions[index] = 2; }
    else { costs[index] = insertion; directions[index] = 3; }
  }
  const operations = []; let i = source.length; let j = typed.length;
  while (i || j) {
    const direction = directions[i * width + j];
    if (direction === 1) operations.push({ source: source[--i], typed: typed[--j], equal: true });
    else if (direction === 4) operations.push({ source: source[--i], typed: typed[--j], equal: false });
    else if (direction === 2 || j === 0) operations.push({ source: source[--i], typed: '', equal: false });
    else operations.push({ source: '', typed: typed[--j], equal: false });
  }
  return operations.reverse();
}

function classifyLocalOperations(sourceText, typedText, whitespaceOnly, allErrorsAreFull, counts) {
  const operations = localCharacterAlignment(sourceText, typedText); const classified = [];
  for (let cursor = 0; cursor < operations.length;) {
    if (operations[cursor].equal) { classified.push({ ...operations[cursor], severity: 'correct', category: 'correct' }); cursor += 1; continue; }
    let end = cursor + 1; while (end < operations.length && !operations[end].equal) end += 1;
    const run = operations.slice(cursor, end); const sourceRun = run.map((item) => item.source).join(''); const typedRun = run.map((item) => item.typed).join('');
    const characters = [...sourceRun, ...typedRun]; let category;
    if (characters.some(isLineBreak)) category = 'paragraphic';
    else if (whitespaceOnly || (characters.length && characters.every(isWhitespace))) category = 'spacing';
    else if (sourceRun && typedRun && sourceRun !== typedRun && sourceRun.toLocaleLowerCase() === typedRun.toLocaleLowerCase()) category = 'capitalization';
    else if (characters.length && characters.every(isPunctuation)) category = 'punctuation';
    else if (sourceRun.length === 2 && typedRun === [...sourceRun].reverse().join('')) category = 'transposition';
    else if (!typedRun) category = 'incompleteWord';
    else if (characters.length && characters.every(isLetter)) category = 'spelling';
    else category = 'substitution';
    counts[category] += 1;
    const severity = !allErrorsAreFull && halfCategories.has(category) ? 'half' : 'full';
    classified.push(...run.map((item) => ({ ...item, severity, category })));
    cursor = end;
  }
  return classified;
}

function appendPart(parts, text, severity = 'correct', category = 'correct') {
  if (!text) return;
  const previous = parts.at(-1);
  if (previous?.severity === severity && previous?.category === category) previous.text += text;
  else parts.push({ text, severity, category });
}

export function classifyErrors(sourceValue, typedValue, allErrorsAreFull = false) {
  const alignment = buildWordAlignment(sourceValue, typedValue); const counts = emptyCounts();
  const referenceParts = []; const typedParts = [];
  const appendOperations = (operations) => {
    for (const item of operations) {
      appendPart(referenceParts, item.source, item.severity, item.category);
      appendPart(typedParts, item.typed, item.severity, item.category);
    }
  };
  const sourceWordSet = new Set(alignment.nodes.flatMap((node) => node.source ? [node.source.text] : []));
  for (let index = 0; index < alignment.nodes.length; index += 1) {
    const node = alignment.nodes[index];
    if (node.source && node.typed) {
      appendOperations(classifyLocalOperations(node.source.before, node.typed.before, true, allErrorsAreFull, counts));
      if (node.type === 'match') { appendPart(referenceParts, node.source.text); appendPart(typedParts, node.typed.text); continue; }
      const wordOperations = classifyLocalOperations(node.source.text, node.typed.text, false, allErrorsAreFull, counts);
      const fullError = wordOperations.find((item) => item.severity === 'full');
      if (fullError) {
        appendPart(referenceParts, node.source.text, 'full', fullError.category);
        appendPart(typedParts, node.typed.text, 'full', fullError.category);
      } else appendOperations(wordOperations);
      continue;
    }
    if (node.source) {
      appendPart(referenceParts, node.source.before); counts.omission += 1;
      appendPart(referenceParts, node.source.text, 'full', 'omission');
      continue;
    }
    appendPart(typedParts, node.typed.before);
    const previousWord = [...alignment.nodes.slice(0, index)].reverse().find((item) => item.source)?.source.text;
    const nextWord = alignment.nodes.slice(index + 1).find((item) => item.source)?.source.text;
    const category = sourceWordSet.has(node.typed.text) && (node.typed.text === previousWord || node.typed.text === nextWord) ? 'repetition' : 'addition';
    counts[category] += 1; appendPart(typedParts, node.typed.text, 'full', category);
  }
  appendOperations(classifyLocalOperations(alignment.sourceTrailing, alignment.typedTrailing, true, allErrorsAreFull, counts));
  const halfErrors = allErrorsAreFull ? 0 : [...halfCategories].reduce((total, category) => total + counts[category], 0);
  const classifiedTotal = Object.values(counts).reduce((total, value) => total + value, 0);
  return { counts, fullErrors: classifiedTotal - halfErrors, halfErrors, weightedErrors: classifiedTotal - halfErrors * 0.5, referenceParts, typedParts };
}

function alignWithinBand(target, input, band) {
  const width = input.length + 1;
  const unreachable = 0x3fffffff;
  let previousCost = new Uint32Array(width);
  let previousCorrect = new Uint32Array(width);
  let previousWrong = new Uint32Array(width);
  let previousOmitted = new Uint32Array(width);
  let previousExtra = new Uint32Array(width);
  let currentCost = new Uint32Array(width);
  let currentCorrect = new Uint32Array(width);
  let currentWrong = new Uint32Array(width);
  let currentOmitted = new Uint32Array(width);
  let currentExtra = new Uint32Array(width);
  let previousStart = 0;
  let previousEnd = Math.min(input.length, band);
  for (let index = 0; index <= previousEnd; index += 1) { previousCost[index] = index; previousExtra[index] = index; }

  for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
    const currentStart = Math.max(0, targetIndex - band);
    const currentEnd = Math.min(input.length, targetIndex + band);
    if (currentStart === 0) {
      currentCost[0] = targetIndex; currentCorrect[0] = 0; currentWrong[0] = 0; currentOmitted[0] = targetIndex; currentExtra[0] = 0;
    }
    for (let inputIndex = Math.max(1, currentStart); inputIndex <= currentEnd; inputIndex += 1) {
      const diagonalAvailable = inputIndex - 1 >= previousStart && inputIndex - 1 <= previousEnd;
      if (diagonalAvailable && target[targetIndex - 1] === input[inputIndex - 1]) {
        currentCost[inputIndex] = previousCost[inputIndex - 1];
        currentCorrect[inputIndex] = previousCorrect[inputIndex - 1] + 1;
        currentWrong[inputIndex] = previousWrong[inputIndex - 1];
        currentOmitted[inputIndex] = previousOmitted[inputIndex - 1];
        currentExtra[inputIndex] = previousExtra[inputIndex - 1];
        continue;
      }
      let operation = 'substitute';
      let bestCost = diagonalAvailable ? previousCost[inputIndex - 1] + 1 : unreachable;
      let bestCorrect = diagonalAvailable ? previousCorrect[inputIndex - 1] : 0;
      const aboveAvailable = inputIndex >= previousStart && inputIndex <= previousEnd;
      const omittedCost = aboveAvailable ? previousCost[inputIndex] + 1 : unreachable;
      if (omittedCost < bestCost || (omittedCost === bestCost && previousCorrect[inputIndex] > bestCorrect)) {
        operation = 'omit'; bestCost = omittedCost; bestCorrect = previousCorrect[inputIndex];
      }
      const leftAvailable = inputIndex - 1 >= currentStart;
      const extraCost = leftAvailable ? currentCost[inputIndex - 1] + 1 : unreachable;
      if (extraCost < bestCost || (extraCost === bestCost && currentCorrect[inputIndex - 1] > bestCorrect)) {
        operation = 'extra'; bestCost = extraCost;
      }
      currentCost[inputIndex] = bestCost;
      if (operation === 'substitute') {
        currentCorrect[inputIndex] = previousCorrect[inputIndex - 1]; currentWrong[inputIndex] = previousWrong[inputIndex - 1] + 1; currentOmitted[inputIndex] = previousOmitted[inputIndex - 1]; currentExtra[inputIndex] = previousExtra[inputIndex - 1];
      } else if (operation === 'omit') {
        currentCorrect[inputIndex] = previousCorrect[inputIndex]; currentWrong[inputIndex] = previousWrong[inputIndex]; currentOmitted[inputIndex] = previousOmitted[inputIndex] + 1; currentExtra[inputIndex] = previousExtra[inputIndex];
      } else {
        currentCorrect[inputIndex] = currentCorrect[inputIndex - 1]; currentWrong[inputIndex] = currentWrong[inputIndex - 1]; currentOmitted[inputIndex] = currentOmitted[inputIndex - 1]; currentExtra[inputIndex] = currentExtra[inputIndex - 1] + 1;
      }
    }
    [previousCost, currentCost] = [currentCost, previousCost];
    [previousCorrect, currentCorrect] = [currentCorrect, previousCorrect];
    [previousWrong, currentWrong] = [currentWrong, previousWrong];
    [previousOmitted, currentOmitted] = [currentOmitted, previousOmitted];
    [previousExtra, currentExtra] = [currentExtra, previousExtra];
    previousStart = currentStart; previousEnd = currentEnd;
  }
  if (input.length < previousStart || input.length > previousEnd) return { correctCharacters: 0, wrongCharacters: 0, omittedCharacters: target.length, extraCharacters: input.length, totalErrors: unreachable };
  return {
    correctCharacters: previousCorrect[input.length],
    wrongCharacters: previousWrong[input.length],
    omittedCharacters: previousOmitted[input.length],
    extraCharacters: previousExtra[input.length],
    totalErrors: previousCost[input.length]
  };
}

export function calculateResult(source, typed, elapsedSeconds, telemetry = {}, scoringRule = {}) {
  const alignment = alignCharacters(source.replace(/\r\n?/g, '\n'), typed.replace(/\r\n?/g, '\n'));
  const wordAlignment = alignWords(source, typed);
  const safeSeconds = Math.max(1, Number(elapsedSeconds) || 1);
  const minutes = safeSeconds / 60;
  const grossWpm = (alignment.typedCharacters / 5) / minutes;
  const evaluationMode = scoringRule.evaluationMode === 'ssc-stenographer' ? 'ssc-stenographer' : 'practice';
  const errors = classifyErrors(source, typed, evaluationMode === 'ssc-stenographer');
  const scoringMode = scoringRule.mode === 'character' ? 'character' : 'standard-word';
  const errorPenalty = Math.min(10, Math.max(0.1, Number(scoringRule.errorPenalty) || 1));
  const errorUnits = errors.weightedErrors * errorPenalty;
  const netWpm = Math.min(grossWpm, Math.max(0, grossWpm - errorUnits / minutes));
  const accuracy = alignment.referenceCharacters ? Math.max(0, (alignment.referenceCharacters - errors.weightedErrors) / alignment.referenceCharacters * 100) : (alignment.typedCharacters ? 0 : 100);
  const round = (value) => Math.round(value * 100) / 100;
  const backspaceCount = Math.max(0, Math.floor(Number(telemetry.backspaceCount) || 0));
  const totalKeystrokes = Math.max(0, Math.floor(Number(telemetry.totalKeystrokes) || 0));

  return {
    grossWpm: round(grossWpm), netWpm: round(netWpm), accuracy: round(accuracy),
    ...alignment,
    ...wordAlignment,
    errorUnits: round(errorUnits), scoringMode, errorPenalty, evaluationMode,
    fullErrors: errors.fullErrors, halfErrors: errors.halfErrors, weightedErrors: errors.weightedErrors,
    errorBreakdown: errors.counts, comparison: { referenceParts: errors.referenceParts, typedParts: errors.typedParts },
    totalKeystrokes,
    backspaceCount,
    timeTaken: round(safeSeconds)
  };
}
