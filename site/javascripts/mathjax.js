window.MathJax = {
  // 1. Load the "physics" package (essential for \ket, \bra, \grad, etc.)
  loader: { load: ['[tex]/physics'] },

  tex: {
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
    processEscapes: true,
    processEnvironments: true,

    // 2. Enable Automatic Equation Numbering
    // Use \label{eq:1} in your markdown and refer to it with \ref{eq:1}
    tags: "ams", 

    // 3. Register the physics package
    packages: {'[+]': ['physics']}
  },
  options: {
    ignoreHtmlClass: ".*|",
    processHtmlClass: "arithmatex"
  }
};
