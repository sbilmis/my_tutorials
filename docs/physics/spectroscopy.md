# Spectroscopic Notation Explorer

!!! abstract "Overview"
    - **Goal:** Explore spectroscopic notation in a compact interactive form.
    - **Families covered:** Atomic, meson, and baryon.
    - **Input modes:** \(L,S\), \(J^P\), and direct spectroscopic notation.
    - **Scope:** Simple LS-coupling picture only.

This page is meant as a short reference plus a small interactive tool.
The basic notation is
 
\[
n^{2S+1}L_J
\]

which compactly encodes radial level, orbital angular momentum, spin, and total angular momentum.

## What the symbols mean

- \(n\) is the radial quantum number or level label.
- \(L\) is orbital angular momentum: \(S,P,D,F,G,\dots\)
- \(S\) is the total spin used in LS coupling.
- \(J\) runs from \(|L-S|\) to \(L+S\).
- \(P\) is parity, which depends on the selected family.

## General rule for parity

For a composite system,

\[
P = \left(\prod_i P_i\right)(-1)^L
\]

where:

- \(P_i\) is the intrinsic parity of each constituent
- \(L\) is the orbital angular momentum

This is the starting point. The atomic, meson, and baryon cases below are special cases of this formula.

## Intrinsic parities used here

For the hadronic examples on this page, we use the standard convention

- quark: \(P_q = +1\)
- antiquark: \(P_{\bar q} = -1\)

So:

- a meson \(q\bar q\) has intrinsic parity product \((+1)(-1) = -1\)
- a baryon \(qqq\) has intrinsic parity product \((+1)^3 = +1\)

## Atomic, meson, and baryon cases

The notation looks similar in all three cases, but the allowed spin values and
parity rules are not the same. Mesons and baryons are both hadrons, but they
are shown separately because the constituent picture is different.

<div class="spectroscopy-family-grid">
  <article class="spectroscopy-family-card spectroscopy-family-card--atomic">
    <p class="spectroscopy-family-card__kicker">Atomic</p>
    <h3>Generic LS coupling</h3>
    <p>Useful for quantum mechanics and atomic spectroscopy examples.</p>
    <p>The spatial wavefunction contributes the orbital factor, so parity is <span class="arithmatex">\((-1)^L\)</span>.</p>
  </article>

  <article class="spectroscopy-family-card spectroscopy-family-card--meson">
    <p class="spectroscopy-family-card__kicker">Meson</p>
    <h3><span class="arithmatex">\(q\bar{q}\)</span> states</h3>
    <p>The orbital part gives <span class="arithmatex">\((-1)^L\)</span>, and the antiquark contributes one extra minus sign, so parity is <span class="arithmatex">\((-1)^{L+1}\)</span>.</p>
  </article>

  <article class="spectroscopy-family-card spectroscopy-family-card--baryon">
    <p class="spectroscopy-family-card__kicker">Baryon</p>
    <h3><span class="arithmatex">\(qqq\)</span> states</h3>
    <p>In the simple three-quark picture, the intrinsic parity product is positive, so only the orbital factor remains and parity is <span class="arithmatex">\((-1)^L\)</span>.</p>
  </article>
</div>

!!! note "Current limitation"
    Tetraquarks, pentaquarks, and hexaquarks are not included here. They are outside the simple LS-coupling model used by this tool.

With these conventions fixed, you can use the interactive calculator below.

<div class="spectroscopy-section-heading">
  <h2>Interactive calculator</h2>
</div>

<div class="spectroscopy-calculator-shell">
  <div class="spectroscopy-calculator-shell__header">
    <p class="spectroscopy-calculator-shell__kicker">Tool</p>
    <h3>Spectroscopy calculator</h3>
    <p>
      Use <span class="arithmatex">\(L,S\)</span> mode to generate allowed states from orbital angular momentum and spin.
      Use <span class="arithmatex">\(J^P\)</span> mode or spectroscopic notation mode for reverse lookup.
      In reverse-lookup mode, <span class="arithmatex">\(L_{\max}\)</span> limits how far the search goes.
    </p>
  </div>

  <div class="spectroscopy-tool" data-spectroscopy-tool>
    <div class="spectroscopy-tool__controls">
      <div class="spectroscopy-tool__row">
        <label class="spectroscopy-tool__field">
          <span>Family</span>
          <select data-field="family">
            <option value="atomic">Atomic</option>
            <option value="meson" selected>Meson</option>
            <option value="baryon">Baryon</option>
          </select>
        </label>

        <label class="spectroscopy-tool__field">
          <span>Mode</span>
          <select data-field="mode">
            <option value="ls" selected>L, S input</option>
            <option value="jp">J^P input</option>
            <option value="notation">Spectroscopic notation input</option>
          </select>
        </label>
      </div>

      <div class="spectroscopy-tool__row" data-dynamic-fields></div>

      <div class="spectroscopy-tool__hint" data-mode-help></div>
      <p class="spectroscopy-tool__error" data-error hidden></p>

      <div class="spectroscopy-tool__actions">
        <button class="md-button md-button--primary" type="button" data-action="compute">
          Compute states
        </button>
        <button class="md-button" type="button" data-action="reset">
          Reset
        </button>
      </div>
    </div>

    <div class="spectroscopy-tool__results">
      <p class="spectroscopy-tool__summary" data-summary>
        Choose a family and input mode to begin.
      </p>

      <div class="spectroscopy-tool__atomic" data-atomic-labels hidden>
        <p class="spectroscopy-tool__subhead">Atomic term labels</p>
        <div class="spectroscopy-tool__chips" data-atomic-chip-list></div>
      </div>

      <div class="spectroscopy-tool__table-wrap">
        <table class="spectroscopy-tool__table" data-results-table hidden>
          <thead>
            <tr>
              <th>Spectroscopic</th>
              <th>Notation</th>
              <th>J^P</th>
              <th>L</th>
              <th>S</th>
              <th>J</th>
            </tr>
          </thead>
          <tbody data-results-body></tbody>
        </table>
      </div>
    </div>
  </div>
</div>
