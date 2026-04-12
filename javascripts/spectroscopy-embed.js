const L_SYMBOLS = {
  0: "S",
  1: "P",
  2: "D",
  3: "F",
  4: "G",
  5: "H",
  6: "I",
  7: "K",
  8: "L",
  9: "M",
};

const SYMBOL_TO_L = Object.fromEntries(
  Object.entries(L_SYMBOLS).map(([value, symbol]) => [symbol, Number(value)]),
);

const FAMILY_RULES = {
  atomic: {
    name: "atomic",
    parityShift: 0,
    allowedSpins: null,
  },
  meson: {
    name: "meson",
    parityShift: 1,
    allowedSpins: ["0", "1"],
  },
  baryon: {
    name: "baryon",
    parityShift: 0,
    allowedSpins: ["1/2", "3/2"],
  },
};

const NOTATION_RE =
  /^\s*(?:n\s*)?\^?\s*(?<multiplicity>\d+)\s*(?<L>[A-Za-z])\s*_?\s*(?<J>\d+(?:\/\d+)?)\s*$/;
const JP_RE = /^\s*(?<J>\d+(?:\/\d+)?)\s*(?:\^)?\s*(?<parity>[+-])\s*$/;

function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left || 1;
}

function makeFraction(numerator, denominator = 1) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new Error("Angular momentum values must be numeric.");
  }
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new Error("Angular momentum values must be integers or simple fractions.");
  }
  if (denominator === 0) {
    throw new Error("Denominator cannot be zero.");
  }
  const sign = denominator < 0 ? -1 : 1;
  const normalizedNumerator = numerator * sign;
  const normalizedDenominator = Math.abs(denominator);
  const divisor = gcd(normalizedNumerator, normalizedDenominator);
  return {
    num: normalizedNumerator / divisor,
    den: normalizedDenominator / divisor,
  };
}

function parseFraction(value) {
  if (typeof value === "object" && value && "num" in value && "den" in value) {
    return makeFraction(value.num, value.den);
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return makeFraction(value, 1);
  }
  const text = String(value).trim();
  if (!text) {
    throw new Error("Angular momentum value cannot be empty.");
  }
  if (text.includes("/")) {
    const [numerator, denominator] = text.split("/");
    return makeFraction(Number(numerator), Number(denominator));
  }
  return makeFraction(Number(text), 1);
}

function compareFractions(left, right) {
  return left.num * right.den - right.num * left.den;
}

function addFractions(left, right) {
  return makeFraction(left.num * right.den + right.num * left.den, left.den * right.den);
}

function subtractFractions(left, right) {
  return makeFraction(left.num * right.den - right.num * left.den, left.den * right.den);
}

function absFraction(value) {
  return makeFraction(Math.abs(value.num), value.den);
}

function formatAngularMomentum(value) {
  const fraction = parseFraction(value);
  if (fraction.den === 1) {
    return String(fraction.num);
  }
  return `${fraction.num}/${fraction.den}`;
}

function validateAngularMomentum(value, label) {
  const fraction = parseFraction(value);
  if (fraction.num < 0) {
    throw new Error(`${label} must be non-negative, got ${formatAngularMomentum(fraction)}.`);
  }
  if (![1, 2].includes(fraction.den)) {
    throw new Error(
      `${label} must be an integer or half-integer, got ${formatAngularMomentum(fraction)}.`,
    );
  }
  return fraction;
}

function fractionKey(value) {
  const fraction = parseFraction(value);
  return `${fraction.num}/${fraction.den}`;
}

function getFamilyRules(family) {
  const rules = FAMILY_RULES[String(family).toLowerCase()];
  if (!rules) {
    throw new Error(
      `Unknown family '${family}'. Supported families: ${Object.keys(FAMILY_RULES).sort().join(", ")}.`,
    );
  }
  return rules;
}

function computeParity(L, family) {
  const rules = getFamilyRules(family);
  const exponent = Number(L) + rules.parityShift;
  return exponent % 2 === 0 ? "+" : "-";
}

function iterJValues(L, S) {
  const orbital = makeFraction(Number(L), 1);
  const spin = parseFraction(S);
  const minimum = absFraction(subtractFractions(orbital, spin));
  const maximum = addFractions(orbital, spin);
  const difference = subtractFractions(maximum, minimum);
  if (difference.den !== 1) {
    throw new Error("Computed J range is not integral in unit steps.");
  }
  const values = [];
  for (let step = 0; step <= difference.num; step += 1) {
    values.push(addFractions(minimum, makeFraction(step, 1)));
  }
  return values;
}

function validateLS(L, S, family) {
  const rules = getFamilyRules(family);
  const lValue = Number.parseInt(String(L), 10);
  if (!Number.isInteger(lValue)) {
    throw new Error(`L must be an integer, got ${JSON.stringify(L)}.`);
  }
  if (lValue < 0) {
    throw new Error(`L must be non-negative, got ${lValue}.`);
  }
  if (!(lValue in L_SYMBOLS)) {
    throw new Error(
      `L=${lValue} is not supported. Supported L values: ${Object.keys(L_SYMBOLS).join(", ")}.`,
    );
  }

  const sValue = validateAngularMomentum(S, "S");
  if (rules.allowedSpins !== null) {
    const allowed = new Set(rules.allowedSpins.map((value) => fractionKey(value)));
    if (!allowed.has(fractionKey(sValue))) {
      throw new Error(
        `S=${formatAngularMomentum(sValue)} is not valid for ${rules.name}. Allowed S values: ${rules.allowedSpins.join(", ")}.`,
      );
    }
  }

  return { L: lValue, S: sValue };
}

function allowedSpinsForSearch(family, maxS = "3") {
  const rules = getFamilyRules(family);
  if (rules.allowedSpins !== null) {
    return rules.allowedSpins.map(parseFraction);
  }

  const upper = validateAngularMomentum(maxS, "max_s");
  const limit = Math.floor((upper.num / upper.den) * 2);
  const values = [];
  for (let step = 0; step <= limit; step += 1) {
    values.push(makeFraction(step, 2));
  }
  return values;
}

function createState({ family, L, S, J, parity }) {
  const spin = parseFraction(S);
  const total = parseFraction(J);
  const multiplicity = (2 * spin.num) / spin.den + 1;
  const notation = `^${multiplicity}${L_SYMBOLS[L]}_${formatAngularMomentum(total)}`;
  return {
    family: family.toLowerCase(),
    L,
    S: spin,
    J: total,
    parity,
    multiplicity,
    LSymbol: L_SYMBOLS[L],
    notation,
    spectroscopic: `n${notation}`,
    jp: `${formatAngularMomentum(total)}^${parity}`,
  };
}

function statesFromLS(L, S, family = "meson") {
  const validated = validateLS(L, S, family);
  const parity = computeParity(validated.L, family);
  return iterJValues(validated.L, validated.S).map((J) =>
    createState({
      family,
      L: validated.L,
      S: validated.S,
      J,
      parity,
    }),
  );
}

function parseNotation(text) {
  const match = String(text).match(NOTATION_RE);
  if (!match?.groups) {
    throw new Error("Notation must look like '^3P_2', '3P2', '^2D_3/2', or 'n^3P_2'.");
  }

  const multiplicity = Number.parseInt(match.groups.multiplicity, 10);
  const symbol = match.groups.L.toUpperCase();
  const J = parseFraction(match.groups.J);
  if (!(symbol in SYMBOL_TO_L)) {
    throw new Error(
      `Unknown L symbol '${symbol}'. Supported symbols: ${Object.keys(SYMBOL_TO_L).sort().join(", ")}.`,
    );
  }

  return {
    L: SYMBOL_TO_L[symbol],
    S: makeFraction(multiplicity - 1, 2),
    J,
  };
}

function stateFromNotation(text, family = "meson") {
  const parsed = parseNotation(text);
  const rules = getFamilyRules(family);

  if (rules.allowedSpins !== null) {
    const allowed = new Set(rules.allowedSpins.map((value) => fractionKey(value)));
    if (!allowed.has(fractionKey(parsed.S))) {
      throw new Error(
        `Notation implies S=${formatAngularMomentum(parsed.S)}, which is not valid for ${rules.name}. Allowed S values: ${rules.allowedSpins.join(", ")}.`,
      );
    }
  } else {
    validateAngularMomentum(parsed.S, "S");
  }

  const allowedJ = iterJValues(parsed.L, parsed.S);
  if (!allowedJ.some((value) => compareFractions(value, parsed.J) === 0)) {
    throw new Error(
      `J=${formatAngularMomentum(parsed.J)} is not allowed for L=${parsed.L}, S=${formatAngularMomentum(parsed.S)}. Allowed J values: ${allowedJ.map(formatAngularMomentum).join(", ")}.`,
    );
  }

  return createState({
    family,
    L: parsed.L,
    S: parsed.S,
    J: parsed.J,
    parity: computeParity(parsed.L, family),
  });
}

function statesFromJP(J, parity, family = "meson", maxL = 5, maxS = "3") {
  const jValue = validateAngularMomentum(J, "J");
  const cleanedParity = String(parity).trim();
  if (!["+", "-"].includes(cleanedParity)) {
    throw new Error(`Parity must be '+' or '-', got ${JSON.stringify(parity)}.`);
  }
  const searchMaxL = Number.parseInt(String(maxL), 10);
  if (!Number.isInteger(searchMaxL) || searchMaxL < 0) {
    throw new Error(`max_l must be non-negative, got ${maxL}.`);
  }

  const candidateSpins = allowedSpinsForSearch(family, maxS);
  const matches = [];
  for (let L = 0; L <= searchMaxL; L += 1) {
    if (computeParity(L, family) !== cleanedParity) {
      continue;
    }
    for (const S of candidateSpins) {
      if (iterJValues(L, S).some((value) => compareFractions(value, jValue) === 0)) {
        matches.push(
          createState({
            family,
            L,
            S,
            J: jValue,
            parity: cleanedParity,
          }),
        );
      }
    }
  }
  return matches;
}

function atomicParityWord(state) {
  return state.parity === "+" ? "even" : "odd";
}

function formatAtomicTermLabel(state) {
  const text = formatAngularMomentum(state.J);
  const jLatex = text.includes("/")
    ? `\\frac{${text.split("/")[0]}}{${text.split("/")[1]}}`
    : text;
  return `{}^{${state.multiplicity}}${state.LSymbol}_{${jLatex}}`;
}

const HELP_TEXT = {
  ls: "Choose L and S to generate every allowed J from |L-S| to L+S.",
  jp: "Provide J and parity to list all candidate spectroscopic labels within the chosen search range.",
  notation:
    "Enter notation such as ^3P_2, 3P2, or ^2D_3/2 to validate the state and compute its J^P assignment.",
};

const L_LABELS = ["S", "P", "D", "F", "G", "H", "I", "K", "L", "M"];

const DEFAULT_VALUES = {
  family: "meson",
  mode: "ls",
  L: "1",
  S: "1",
  J: "1",
  parity: "-",
  maxL: "5",
  maxS: "3",
  notation: "^3P_2",
};

function angularMomentumToLatex(value) {
  const text = formatAngularMomentum(value);
  if (!text.includes("/")) {
    return text;
  }
  const [numerator, denominator] = text.split("/");
  return `\\frac{${numerator}}{${denominator}}`;
}

function toInlineMath(latex) {
  return `<span class="arithmatex">\\(${latex}\\)</span>`;
}

function stateToLatex(state) {
  const jLatex = angularMomentumToLatex(state.J);
  const sLatex = angularMomentumToLatex(state.S);
  return {
    spectroscopic: toInlineMath(`n\\,{}^{${state.multiplicity}}${state.LSymbol}_{${jLatex}}`),
    notation: toInlineMath(`{}^{${state.multiplicity}}${state.LSymbol}_{${jLatex}}`),
    jp: toInlineMath(`${jLatex}^{${state.parity}}`),
    s: toInlineMath(sLatex),
    j: toInlineMath(jLatex),
  };
}

function fieldTemplate(id, label, control) {
  return `
    <label class="spectroscopy-tool__field" for="${id}">
      <span>${label}</span>
      ${control}
      <div class="spectroscopy-tool__preview" data-preview-for="${id}" hidden></div>
    </label>
  `;
}

function selectOptions(options, selectedValue) {
  return options
    .map(
      (option) =>
        `<option value="${option.value}"${option.value === selectedValue ? " selected" : ""}>${option.label}</option>`,
    )
    .join("");
}

function setupTool(root) {
  let currentValues = { ...DEFAULT_VALUES };

  const familySelect = root.querySelector('[data-field="family"]');
  const modeSelect = root.querySelector('[data-field="mode"]');
  const dynamicFields = root.querySelector("[data-dynamic-fields]");
  const help = root.querySelector("[data-mode-help]");
  const errorBox = root.querySelector("[data-error]");
  const summary = root.querySelector("[data-summary]");
  const table = root.querySelector("[data-results-table]");
  const resultsBody = root.querySelector("[data-results-body]");
  const atomicLabels = root.querySelector("[data-atomic-labels]");
  const atomicChipList = root.querySelector("[data-atomic-chip-list]");
  const computeButton = root.querySelector('[data-action="compute"]');
  const resetButton = root.querySelector('[data-action="reset"]');

  function syncCurrentValues() {
    const fields = root.querySelectorAll("input, select");
    fields.forEach((field) => {
      if (field.name) {
        currentValues[field.name] = field.value;
      }
    });
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function showError(message) {
    errorBox.hidden = false;
    errorBox.textContent = message;
  }

  function clearResults(message = "Inputs updated. Compute states to refresh the results.") {
    clearError();
    resultsBody.innerHTML = "";
    atomicChipList.innerHTML = "";
    atomicLabels.hidden = true;
    table.hidden = true;
    summary.textContent = message;
  }

  function buildFields() {
    const family = familySelect.value;
    const mode = modeSelect.value;
    let html = "";

    if (mode === "ls") {
      html += fieldTemplate(
        "L",
        "L",
        `<select id="L" name="L">${selectOptions(
          Array.from({ length: 10 }, (_, value) => ({
            value: String(value),
            label: `${value} (${L_LABELS[value]})`,
          })),
          currentValues.L,
        )}</select>`,
      );

      if (family === "atomic") {
        html += fieldTemplate(
          "S",
          "S",
          `<input id="S" name="S" type="text" value="${currentValues.S}" placeholder="0, 1/2, 1, 3/2" />`,
        );
      } else if (family === "meson") {
        html += fieldTemplate(
          "S",
          "S",
          `<select id="S" name="S">${selectOptions(
            [
              { value: "0", label: "0" },
              { value: "1", label: "1" },
            ],
            currentValues.S,
          )}</select>`,
        );
      } else {
        html += fieldTemplate(
          "S",
          "S",
          `<select id="S" name="S">${selectOptions(
            [
              { value: "1/2", label: "1/2" },
              { value: "3/2", label: "3/2" },
            ],
            currentValues.S,
          )}</select>`,
        );
      }
    }

    if (mode === "jp") {
      html += fieldTemplate(
        "J",
        "J",
        `<input id="J" name="J" type="text" value="${currentValues.J}" placeholder="1, 1/2, 3/2" />`,
      );
      html += fieldTemplate(
        "parity",
        "Parity",
        `<select id="parity" name="parity">${selectOptions(
          [
            { value: "+", label: "+" },
            { value: "-", label: "-" },
          ],
          currentValues.parity,
        )}</select>`,
      );
      html += fieldTemplate(
        "maxL",
        "Maximum L",
        `<input id="maxL" name="maxL" type="number" min="0" step="1" value="${currentValues.maxL}" />`,
      );
      if (family === "atomic") {
        html += fieldTemplate(
          "maxS",
          "Maximum S",
          `<input id="maxS" name="maxS" type="text" value="${currentValues.maxS}" placeholder="3, 5/2, 7/2" />`,
        );
      }
    }

    if (mode === "notation") {
      html += fieldTemplate(
        "notation",
        "Notation",
        `<input id="notation" name="notation" type="text" value="${currentValues.notation}" placeholder="^3P_2, 3P2, ^2D_3/2" />`,
      );
    }

    dynamicFields.innerHTML = html;
    help.textContent = HELP_TEXT[mode];
    updatePreviews();
  }

  function typeset() {
    if (window.MathJax?.typesetPromise) {
      return window.MathJax.typesetPromise([root]).catch(() => {});
    }
    return Promise.resolve();
  }

  function setPreview(id, content) {
    const preview = root.querySelector(`[data-preview-for="${id}"]`);
    if (!preview) {
      return;
    }
    if (!content) {
      preview.hidden = true;
      preview.innerHTML = "";
      return;
    }
    preview.hidden = false;
    preview.innerHTML = content;
  }

  function notationPreviewFromValues() {
    const family = familySelect.value;
    const mode = modeSelect.value;

    try {
      if (mode === "ls" && currentValues.L !== undefined && currentValues.S) {
        const states = statesFromLS(currentValues.L, currentValues.S, family);
        if (!states.length) {
          return null;
        }
        const state = states[0];
        return `Preview: ${toInlineMath(`{}^{${state.multiplicity}}${state.LSymbol}`)} with selected ${toInlineMath(`L=${state.L},\\;S=${angularMomentumToLatex(state.S)}`)}`;
      }

      if (mode === "jp" && currentValues.J && currentValues.parity) {
        return `Preview: ${toInlineMath(`${angularMomentumToLatex(currentValues.J)}^{${currentValues.parity}}`)}`;
      }

      if (mode === "notation" && currentValues.notation?.trim()) {
        const state = stateFromNotation(currentValues.notation, family);
        return `Preview: ${toInlineMath(`{}^{${state.multiplicity}}${state.LSymbol}_{${angularMomentumToLatex(state.J)}}`)}`;
      }
    } catch {
      return null;
    }

    return null;
  }

  function updatePreviews() {
    setPreview("L", currentValues.L !== undefined ? `Selected: ${toInlineMath(`L=${currentValues.L}`)}` : null);
    setPreview("S", currentValues.S ? `Selected: ${toInlineMath(`S=${angularMomentumToLatex(currentValues.S)}`)}` : null);
    setPreview("J", currentValues.J ? `Selected: ${toInlineMath(`J=${angularMomentumToLatex(currentValues.J)}`)}` : null);
    setPreview("parity", currentValues.parity ? `Selected: ${toInlineMath(`P=${currentValues.parity}`)}` : null);
    setPreview("maxL", currentValues.maxL ? `Search bound: ${toInlineMath(`L_{\\max}=${currentValues.maxL}`)}` : null);
    setPreview("maxS", currentValues.maxS ? `Search bound: ${toInlineMath(`S_{\\max}=${angularMomentumToLatex(currentValues.maxS)}`)}` : null);
    setPreview("notation", notationPreviewFromValues());
    void typeset();
  }

  function renderResults(states, family, mode) {
    resultsBody.innerHTML = "";
    atomicChipList.innerHTML = "";
    clearError();

    if (!states.length) {
      table.hidden = true;
      atomicLabels.hidden = true;
      summary.textContent = "No matching states found within the current search limits.";
      return;
    }

    summary.textContent = `${states.length} matching state${states.length === 1 ? "" : "s"} for ${family} in ${mode.toUpperCase()} mode.`;

    states.forEach((state) => {
      const latex = stateToLatex(state);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${latex.spectroscopic}</td>
        <td>${latex.notation}</td>
        <td>${latex.jp}</td>
        <td>${state.L}</td>
        <td>${latex.s}</td>
        <td>${latex.j}</td>
      `;
      resultsBody.appendChild(row);
    });

    table.hidden = false;

    if (family === "atomic") {
      states.forEach((state) => {
        const chip = document.createElement("div");
        chip.className = "spectroscopy-tool__chip";
        chip.innerHTML = `${toInlineMath(formatAtomicTermLabel(state))} <em>${atomicParityWord(state)}</em>`;
        atomicChipList.appendChild(chip);
      });
      atomicLabels.hidden = false;
    } else {
      atomicLabels.hidden = true;
    }

    void typeset();
  }

  function compute() {
    syncCurrentValues();
    const family = familySelect.value;
    const mode = modeSelect.value;

    try {
      let states = [];
      if (mode === "ls") {
        states = statesFromLS(currentValues.L, currentValues.S, family);
      } else if (mode === "jp") {
        states = statesFromJP(
          currentValues.J,
          currentValues.parity,
          family,
          currentValues.maxL || "5",
          currentValues.maxS || "3",
        );
      } else {
        states = [stateFromNotation(currentValues.notation, family)];
      }
      renderResults(states, family, mode);
    } catch (error) {
      clearResults("The input needs adjustment before results can be computed.");
      showError(error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  function reset() {
    currentValues = { ...DEFAULT_VALUES };
    familySelect.value = currentValues.family;
    modeSelect.value = currentValues.mode;
    buildFields();
    clearResults("Choose a family and input mode to begin.");
  }

  familySelect.addEventListener("change", () => {
    syncCurrentValues();
    currentValues.family = familySelect.value;
    if (familySelect.value === "meson") {
      currentValues.S = "1";
    } else if (familySelect.value === "baryon") {
      currentValues.S = "1/2";
    } else {
      currentValues.S = "3/2";
    }
    buildFields();
    clearResults();
  });

  modeSelect.addEventListener("change", () => {
    syncCurrentValues();
    currentValues.mode = modeSelect.value;
    buildFields();
    clearResults();
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }
    if (target.name) {
      currentValues[target.name] = target.value;
      updatePreviews();
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }
    if (target.name) {
      currentValues[target.name] = target.value;
      updatePreviews();
    }
  });

  computeButton.addEventListener("click", compute);
  resetButton.addEventListener("click", reset);

  buildFields();
}

document.querySelectorAll("[data-spectroscopy-tool]").forEach(setupTool);
