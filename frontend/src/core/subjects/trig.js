(function(){
  // Trig subject module (browser + Node friendly)
  const TRIG_CONFIG = {
    functions: ['sin','cos','tan','csc','cosec','sec','cot'],
    arguments: [
      'x','\\theta','\\alpha','45^{\\circ}','30^{\\circ}','60^{\\circ}','90^{\\circ}','0^{\\circ}','\\beta','\\gamma','\\pi',
      '\\frac{\\pi}{6}','\\frac{\\pi}{4}','\\frac{\\pi}{3}','\\frac{\\pi}{2}','\\frac{2\\pi}{3}','\\frac{3\\pi}{4}','\\frac{5\\pi}{6}','\\frac{3\\pi}{2}'
    ],
    modifiers: { '^-1':{latex:'^{-1}'}, '^2':{latex:'^{2}'}, '^3':{latex:'^{3}'}, '^n':{latex:'^{n}'} }
  };

  // Fuzzy matching rules for trig functions
  const FUZZY_TRIG_RULES = [
    {key:'sin', suggestions:['\\sin(x)','\\sin(\\theta)']},
    {key:'cos', suggestions:['\\cos(x)','\\cos(\\theta)']},
    {key:'tan', suggestions:['\\tan(x)','\\tan(\\theta)']},
    {key:'sec', suggestions:['\\sec(x)','\\sec(\\theta)']},
    {key:'cosec', suggestions:['\\csc(x)','\\csc(\\theta)']},
    {key:'cot', suggestions:['\\cot(x)','\\cot(\\theta)']},
    {key:'csc', suggestions:['\\csc(x)','\\csc(\\theta)']},
    {key:'asin', suggestions:['\\sin^{-1}(x)']},
    {key:'arcsin', suggestions:['\\sin^{-1}(x)']},
    {key:'acos', suggestions:['\\cos^{-1}(x)']},
    {key:'arccos', suggestions:['\\cos^{-1}(x)']},
    {key:'atan', suggestions:['\\tan^{-1}(x)']},
    {key:'arctan', suggestions:['\\tan^{-1}(x)']},
    {key:'sin-1', suggestions:['\\sin^{-1}(x)']},
    {key:'sin^-1', suggestions:['\\sin^{-1}(x)']},
    {key:'cos-1', suggestions:['\\cos^{-1}(x)']},
    {key:'cos^-1', suggestions:['\\cos^{-1}(x)']},
    {key:'tan-1', suggestions:['\\tan^{-1}(x)']},
    {key:'tan^-1', suggestions:['\\tan^{-1}(x)']}
  ];

  function levenshteinDistance(a, b){
    if (a===b) return 0;
    const matrix = Array.from({length: a.length+1},()=>Array(b.length+1).fill(0));
    for (let i=0;i<=a.length;i++) matrix[i][0]=i;
    for (let j=0;j<=b.length;j++) matrix[0][j]=j;
    for (let i=1;i<=a.length;i++){
      for (let j=1;j<=b.length;j++){
        const cost = a[i-1]===b[j-1]?0:1;
        matrix[i][j] = Math.min(matrix[i-1][j]+1, matrix[i][j-1]+1, matrix[i-1][j-1]+cost);
      }
    }
    return matrix[a.length][b.length];
  }

  function getFuzzySuggestions(value, maxSuggestions = 5){
    const normalized = String(value).toLowerCase().replace(/\\/g,'');
    const candidates = FUZZY_TRIG_RULES.map(r=>({...r, distance:levenshteinDistance(normalized,r.key)}));
    candidates.sort((a,b)=>a.distance-b.distance);
    const best = candidates[0];
    if (!best) return [];
    const threshold = normalized.length <= 4 ? 1 : 2;
    if (best.distance > threshold) return [];
    return best.suggestions.slice(0, maxSuggestions);
  }

  function parseTrigExpression(input){
    const normalized = String(input).toLowerCase().trim();
    const patterns = [
      /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*\(\s*(.*)$/i,
      /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*(\d*(?:\\pi|π|pi)(?:\/\d+)?|\d*(?:\\pi|π|pi)\s*\/\s*\d+)$/i,
      /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*(\d+[a-z\\πθ][a-z0-9\\πθ]*)$/i,
      /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*(\d+(?:\.\d+)?)$/i,
      /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*([a-z\\πθ][a-z0-9\\πθ]*)$/i,
      /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)((?:\^\{?-?1\}?|\^2|\^3|\^n)?)\s*$/i,
      /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)\s*\(\s*(.*)$/i,
      /^(?:\\)?(sin|cos|tan|csc|cosec|sec|cot)\s*$/i
    ];

    for (const p of patterns){
      const m = normalized.match(p);
      if (m){
        const func = m[1].toLowerCase();
        const modifier = m[2] || '';
        let arg = m[3] || '';
        if (typeof arg === 'string'){
          arg = arg.trim();
          if (arg.endsWith(')')) arg = arg.slice(0,-1).trim();
        }
        return { function: func, modifier, argument: arg, matched: true };
      }
    }
    return { matched: false };
  }

  function generateTrigSuggestions(parsed, maxSuggestions = 5){
    if (!parsed.matched) return [];
    const func = parsed.function; const modifier = parsed.modifier; const argument = parsed.argument;
    const normalizedFunc = func === 'cosec' ? 'csc' : func;
    const latexFunc = `\\${normalizedFunc}`;
    let modifierLatex = '';
    if (modifier){ if (modifier.includes('-1')||modifier==='^-1') modifierLatex='^{-1}'; else if (modifier==='^2') modifierLatex='^{2}'; else if (modifier==='^3') modifierLatex='^{3}'; }
    if (argument){
      const rawArg = String(argument).trim();
      const degreeMatch = rawArg.match(/^(\d+(?:\.\d+)?)\s*(?:o|deg|degree|degrees|°)$/i);
      if (degreeMatch) return [`${latexFunc}${modifierLatex}(${degreeMatch[1]}^{\\circ})`];
      const plainNumberMatch = rawArg.match(/^(\d+)$/);
      if (plainNumberMatch){
        const num = plainNumberMatch[1];
        if (num==='2' && !modifierLatex) return [ `${latexFunc}(2^{\\circ})`, `${latexFunc}^{2}(x)`, `${latexFunc}^{2}(\\theta)`, `${latexFunc}(2x)`, `${latexFunc}(2\\theta)` ].slice(0,maxSuggestions);
        
        // Common O-level special angles with degree and radian notation
        const specialAngles = {
          '30': '\\frac{\\pi}{6}',
          '45': '\\frac{\\pi}{4}',
          '60': '\\frac{\\pi}{3}',
          '90': '\\frac{\\pi}{2}',
          '120': '\\frac{2\\pi}{3}',
          '135': '\\frac{3\\pi}{4}',
          '150': '\\frac{5\\pi}{6}',
          '180': '\\pi',
          '270': '\\frac{3\\pi}{2}',
          '360': '2\\pi'
        };
        
        if (specialAngles[num]) {
          const rad = specialAngles[num];
          return [ `${latexFunc}${modifierLatex}(${num}^{\\circ})`, `${latexFunc}${modifierLatex}(${rad})` ].slice(0,maxSuggestions);
        }
        
        return [`${latexFunc}${modifierLatex}(${num}^{\\circ})`];
      }
      const inlineCoeffMatch = rawArg.match(/^(\d+)(\\[a-zA-Z]+|[a-zA-Z]|π|θ)$/);
      if (inlineCoeffMatch){
        const coeff = inlineCoeffMatch[1]; const varToken = inlineCoeffMatch[2];
        const key = varToken.replace(/^\\/,'').toLowerCase();
        const map = { 'theta':'\\theta','θ':'\\theta','x':'x','t':'t','alpha':'\\alpha','beta':'\\beta','gamma':'\\gamma','pi':'\\pi','π':'\\pi' };
        const mapped = map[key] || varToken;
        const direct = `${latexFunc}${modifierLatex}(${coeff}${mapped})`;
        if (!modifierLatex && Number.isFinite(Number(coeff)) && Number(coeff) >= 2){ const power = `${latexFunc}^{${coeff}}(${mapped})`; return [direct,power].slice(0,maxSuggestions); }
        return [direct];
      }
      const piMatch = rawArg.match(/^(?:([0-9]+)\s*)?(?:\\pi|π|pi)(?:\s*\/\s*([0-9]+))?$/i);
      if (piMatch){
        const num = piMatch[1] ? Number(piMatch[1]) : 1; const den = piMatch[2] ? Number(piMatch[2]) : null; const suggestions = [];
        if (den){ if (num===1) suggestions.push(`${latexFunc}${modifierLatex}(\\frac{\\pi}{${den}})`); else suggestions.push(`${latexFunc}${modifierLatex}(\\frac{${num}\\pi}{${den}})`); if (num===1) suggestions.push(`\\frac{${latexFunc}${modifierLatex}(\\pi)}{${den}}`); else suggestions.push(`\\frac{${latexFunc}${modifierLatex}(${num}\\pi)}{${den}}`); }
        else { if (num===1) suggestions.push(`${latexFunc}${modifierLatex}(\\pi)`); else { suggestions.push(`${latexFunc}${modifierLatex}(${num}\\pi)`); suggestions.push(`${latexFunc}${modifierLatex}(${num} \\cdot \\pi)`); } }
        return suggestions.slice(0,maxSuggestions);
      }
      const thetaMatch = rawArg.match(/^(?:\\theta|θ|theta|x|t|alpha|beta|gamma)$/i);
      if (thetaMatch){ const map = { 'theta':'\\theta','θ':'\\theta','x':'x','t':'t','alpha':'\\alpha','beta':'\\beta','gamma':'\\gamma' }; const key = rawArg.replace(/\\/g,'').toLowerCase(); const mapped = map[key] || rawArg; return [`${latexFunc}${modifierLatex}(${mapped})`]; }
      const lowerArg = rawArg.toLowerCase().replace(/\\/g,'').replace(/[{}\\]/g,'').replace(/\s+/g,'');
      const completedArgs = TRIG_CONFIG.arguments.filter(a=>{ const norm = a.toLowerCase().replace(/\\/g,'').replace(/[{}\\]/g,'').replace(/\s+/g,''); return norm.includes(lowerArg) || lowerArg.includes(norm); }).slice(0,maxSuggestions);
      return completedArgs.map(arg=>`${latexFunc}${modifierLatex}(${arg})`);
    }
    return TRIG_CONFIG.arguments.slice(0,maxSuggestions).map(arg=>`${'\\'+parsed.function}${(parsed.modifier||'').replace('^-1','^{-1}') }(${arg})`);
  }

  function getTrigSuggestions(input, maxSuggestions = 5){
    console.log('[trig.js getTrigSuggestions] Input:', input);
    
    // Try structured parsing first
    const parsed = parseTrigExpression(input);
    console.log('[trig.js] Parsed result:', parsed);
    
    if (parsed.matched) {
      const suggestions = generateTrigSuggestions(parsed, maxSuggestions);
      console.log('[trig.js] Generated suggestions:', suggestions);
      if (suggestions.length) return suggestions;
    }
    
    // Fallback to fuzzy matching
    const fuzzySuggestions = getFuzzySuggestions(input, maxSuggestions);
    console.log('[trig.js] Fuzzy suggestions:', fuzzySuggestions);
    if (fuzzySuggestions.length) return fuzzySuggestions;
    
    return [];
  }

  // attach to globalThis.subjects and export for Node
  if (typeof globalThis !== 'undefined'){
    globalThis.subjects = globalThis.subjects || {};
    globalThis.subjects.trig = { getTrigSuggestions, parseTrigExpression, generateTrigSuggestions, getFuzzySuggestions };
  }
  if (typeof module !== 'undefined' && module.exports){
    module.exports = { getTrigSuggestions, parseTrigExpression, generateTrigSuggestions, getFuzzySuggestions };
  }
})();
