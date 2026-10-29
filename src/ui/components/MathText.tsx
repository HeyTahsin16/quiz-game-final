import katex from 'katex'
import {useMemo} from 'react'

export interface MathTextProps {
	text: string
	className?: string
}

const SUPERSCRIPT_MAP: Record<string, string> = {
	'⁰': '0',
	'¹': '1',
	'²': '2',
	'³': '3',
	'⁴': '4',
	'⁵': '5',
	'⁶': '6',
	'⁷': '7',
	'⁸': '8',
	'⁹': '9',
	'⁺': '+',
	'⁻': '-',
	'ⁿ': 'n',
}

const SUBSCRIPT_MAP: Record<string, string> = {
	'₀': '0',
	'₁': '1',
	'₂': '2',
	'₃': '3',
	'₄': '4',
	'₅': '5',
	'⁶': '6',
	'⁷': '7',
	'₈': '8',
	'₉': '9',
	'₊': '+',
	'₋': '-',
}

function convertUnicodeSupSubToLatex(expr: string): string {
	let out = expr
	out = out.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+/g, (match) => {
		const mapped = Array.from(match)
			.map((ch) => SUPERSCRIPT_MAP[ch] ?? ch)
			.join('')
		return `^{${mapped}}`
	})
	out = out.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋]+/g, (match) => {
		const mapped = Array.from(match)
			.map((ch) => SUBSCRIPT_MAP[ch] ?? ch)
			.join('')
		return `_{${mapped}}`
	})
	return out
}

function stripOuterParens(expr: string): string {
	const trimmed = expr.trim()
	if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
		return trimmed
	}
	let depth = 0
	for (let i = 0; i < trimmed.length; i++) {
		const ch = trimmed[i]
		if (ch === '(') depth++
		else if (ch === ')') {
			depth--
			if (depth === 0 && i < trimmed.length - 1) {
				return trimmed
			}
		}
	}
	return trimmed.slice(1, -1).trim()
}

export function normalizeMathFragmentToLatex(fragment: string): string {
	let s = fragment.trim()

	// Convert 2x2 matrices: det([[a, b], [c, d]]) or [[a, b], [c, d]]
	s = s.replace(/det\(\[\[([^\]]+)\],\s*\[([^\]]+)\]\]\)/g, (_m, r1: string, r2: string) => {
		const c1 = r1
			.split(',')
			.map((x) => normalizeMathFragmentToLatex(x.trim()))
			.join(' & ')
		const c2 = r2
			.split(',')
			.map((x) => normalizeMathFragmentToLatex(x.trim()))
			.join(' & ')
		return `\\det\\begin{pmatrix} ${c1} \\\\ ${c2} \\end{pmatrix}`
	})
	s = s.replace(/\[\[([^\]]+)\],\s*\[([^\]]+)\]\]/g, (_m, r1: string, r2: string) => {
		const c1 = r1
			.split(',')
			.map((x) => normalizeMathFragmentToLatex(x.trim()))
			.join(' & ')
		const c2 = r2
			.split(',')
			.map((x) => normalizeMathFragmentToLatex(x.trim()))
			.join(' & ')
		return `\\begin{pmatrix} ${c1} \\\\ ${c2} \\end{pmatrix}`
	})

	// Convert √((...)) and √(...) and √token recursively
	s = s.replace(/√\(\(([^()]+)\)\s*([+-])\s*\(([^()]+)\)([²³]?)\)/g, (_m, a, op, b, sup) => {
		return `\\sqrt{(${normalizeMathFragmentToLatex(a)}) ${op} (${normalizeMathFragmentToLatex(b)})${convertUnicodeSupSubToLatex(sup)}}`
	})
	s = s.replace(/√\(([^()]+)\)/g, (_m, inner: string) => `\\sqrt{${normalizeMathFragmentToLatex(inner)}}`)
	s = s.replace(
		/√([0-9]+(?:\.[0-9]+)?|[a-zA-Zπ₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,
		(_m, tok: string) => `\\sqrt{${normalizeMathFragmentToLatex(tok)}}`,
	)

	// Convert ^( ... ) with nested parens up to 1 level
	s = s.replace(/\^\(([^()]+(?:\([^()]*\)[^()]*)*)\)/g, (_m, inner: string) => {
		return `^{${normalizeMathFragmentToLatex(inner)}}`
	})
	s = s.replace(/\^([0-9]{2,}|[0-9a-zA-Z+-]+)/g, (_m, exp: string) => `^{${exp}}`)

	// Convert _{...} and _word subscripts (including compound chemical subscripts like _O₂ or _He)
	s = s.replace(/_\{([^}]+)\}/g, (_m, inner: string) => `_{${normalizeMathFragmentToLatex(inner)}}`)
	s = s.replace(/_([a-zA-Z]+[₀₁₂₃₄₅₆₇₈₉]+)/g, (_m, sub: string) => {
		const converted = convertUnicodeSupSubToLatex(sub)
		return `_{${converted}}`
	})
	s = s.replace(/_([a-zA-Z0-9]+)/g, '_{\\text{$1}}')

	// Convert unicode superscripts and subscripts
	s = convertUnicodeSupSubToLatex(s)

	// Convert divisions inside math fragments into \frac{num}{den}
	if (s.includes('/')) {
		// Parenthesized numerator and parenthesized denominator: (A) / (B)
		s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_m, num: string, den: string) => {
			return `\\frac{${normalizeMathFragmentToLatex(num)}}{${normalizeMathFragmentToLatex(den)}}`
		})
		// Parenthesized numerator with exponent and parenthesized denominator: (2x)^{2} / (1 - x)
		s = s.replace(
			/(\([^()]+\)\^\{[^{}]+\})\s*\/\s*\(([^()]+)\)/g,
			(_m, num: string, den: string) => {
				return `\\frac{${num}}{${normalizeMathFragmentToLatex(den)}}`
			},
		)
		// Parenthesized numerator with exponent and simple denominator: (2x)^{4} / 24
		s = s.replace(
			/(\([^()]+\)\^\{[^{}]+\})\s*\/\s*([a-zA-Z0-9.\\{}^_+-]+!?)/g,
			(_m, num: string, den: string) => {
				return `\\frac{${num}}{${den}}`
			},
		)
		// Parenthesized numerator and simple denominator: (A) / B
		s = s.replace(/\(([^()]+)\)\s*\/\s*([a-zA-Z0-9.\\{}^_+-]+!?)/g, (_m, num: string, den: string) => {
			return `\\frac{${normalizeMathFragmentToLatex(num)}}{${den}}`
		})
		// Simple numerator and parenthesized denominator: A / (B)
		s = s.replace(/([a-zA-Z0-9.\\{}^_+-]+!?)\s*\/\s*\(([^()]+)\)/g, (_m, num: string, den: string) => {
			return `\\frac{${num}}{${normalizeMathFragmentToLatex(den)}}`
		})
		// Simple or bracketed or absolute-value tokens separated by /: A / B
		s = s.replace(
			/(\|[^|/]+\||\[[^\]/]+\](?:_\{[^{}]+\})?|[+-]?[a-zA-Z0-9πθλμωℏΩΔΦΨερτηφζχγαβσ°.\\{}^_!]+)\s*\/\s*(\|[^|/]+\||\[[^\]/]+\](?:_\{[^{}]+\})?|[+-]?[a-zA-Z0-9πθλμωℏΩΔΦΨερτηφζχγαβσ°.\\{}^_!]+)/g,
			(_m, num: string, den: string) => {
				return `\\frac{${stripOuterParens(num)}}{${stripOuterParens(den)}}`
			},
		)
	}

	// Replace prime symbols, standard trig/log functions, and Greek/math symbols
	s = s
		.replace(/\b(sin|cos|tan|sec|csc|cot|ln|log)\b/g, '\\$1')
		.replace(/\\\\(sin|cos|tan|sec|csc|cot|ln|log)/g, '\\$1')
		.replace(/°/g, '^\\circ ')
		.replace(/″/g, "''")
		.replace(/′/g, "'")
		.replace(/×/g, '\\times ')
		.replace(/÷/g, '\\div ')
		.replace(/·/g, '\\cdot ')
		.replace(/±/g, '\\pm ')
		.replace(/≈/g, '\\approx ')
		.replace(/≠/g, '\\neq ')
		.replace(/≤/g, '\\le ')
		.replace(/≥/g, '\\ge ')
		.replace(/≡/g, '\\equiv ')
		.replace(/∝/g, '\\propto ')
		.replace(/∞/g, '\\infty ')
		.replace(/∇/g, '\\nabla ')
		.replace(/∂/g, '\\partial ')
		.replace(/ℏ/g, '\\hbar ')
		.replace(/⇒/g, '\\Rightarrow ')
		.replace(/⇌/g, '\\rightleftharpoons ')
		.replace(/→/g, '\\to ')
		.replace(/ℝ/g, '\\mathbb{R}')
		.replace(/¼/g, '\\frac{1}{4}')
		.replace(/½/g, '\\frac{1}{2}')
		.replace(/¾/g, '\\frac{3}{4}')
		.replace(/π/g, '\\pi ')
		.replace(/θ/g, '\\theta ')
		.replace(/λ/g, '\\lambda ')
		.replace(/μ/g, '\\mu ')
		.replace(/ω/g, '\\omega ')
		.replace(/Ω/g, '\\Omega ')
		.replace(/Δ/g, '\\Delta ')
		.replace(/Φ/g, '\\Phi ')
		.replace(/Ψ/g, '\\Psi ')
		.replace(/ε/g, '\\varepsilon ')
		.replace(/ρ/g, '\\rho ')
		.replace(/τ/g, '\\tau ')
		.replace(/η/g, '\\eta ')
		.replace(/φ/g, '\\varphi ')
		.replace(/ζ/g, '\\zeta ')
		.replace(/χ/g, '\\chi ')
		.replace(/γ/g, '\\gamma ')
		.replace(/α/g, '\\alpha ')
		.replace(/β/g, '\\beta ')
		.replace(/σ/g, '\\sigma ')

	return s
}

function applyOutsideDollars(text: string, regex: RegExp, replacer: (...args: any[]) => string): string {
	return text
		.split(/(\$[^$]+\$)/g)
		.map((part) => {
			if (part.startsWith('$') && part.endsWith('$')) {
				return part
			}
			return part.replace(regex, replacer)
		})
		.join('')
}

const NON_DIVISION_SLASH_PHRASES: string[] = [
	'L·bar/(mol·K)',
	'kJ/(mol·K)',
	'J/(mol·K)',
	'J/(kg·°C)',
	'individuals/yr',
	'kg·m/s',
	'm/s²',
	'm/s',
	'rad/s',
	'J/s',
	'N/m',
	'kJ/mol',
	'g/mol',
	'J/mol',
	'C/mol',
	'mol/L',
	'L/mol',
	'°C/m',
	'H⁺ / ATP',
	'Na⁺/K⁺',
	'Cu²⁺/Cu',
	'Zn²⁺/Zn',
	'glucose/amino',
	'malate/aspartate',
	'RAG1/RAG2',
	'ABC / abc',
	'AbC / aBc',
	'B/b',
	'+2/-2',
]

/**
 * Replaces mathematical expressions in plain text with `$...$` LaTeX blocks
 * so KaTeX renders all divisions as vertical fractions (`\frac{x}{y}`), along with
 * integrals, limits, sums, matrices, roots, and exponents.
 */
export function preprocessPlainMathToDelimitedLatex(input: string): string {
	let text = input

	// 1. Specific complex calculus/algebra/physics expressions in the STEM question bank
	const exactReplacements: Array<[RegExp, string]> = [
		[/L\{t²\}\(s\)\s*=\s*∫₀\^∞\s*t²\s*e\^\(-st\)\s*dt/g, '$\\mathcal{L}\\{t^2\\}(s) = \\int_{0}^{\\infty} t^2 e^{-st}\\,dt$'],
		[/L\{t\^n\}\(s\)\s*=\s*n!\s*\/\s*s\^\(n\+1\)/g, '$\\mathcal{L}\\{t^n\\}(s) = \\frac{n!}{s^{n+1}}$'],
		[/∫_\{-∞\}\^\{∞\}\s*e\^\(-x²\)\s*dx/g, '$\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx$'],
		[/∫₀\^\(π\/2\)\s*sin\(x\)\s*cos\(x\)\s*dx/g, '$\\int_{0}^{\\frac{\\pi}{2}} \\sin(x)\\cos(x)\\,dx$'],
		[/\[sin²\(x\)\/2\]₀\^\(π\/2\)\s*=\s*1\/2/g, '$\\left[\\frac{\\sin^2(x)}{2}\\right]_{0}^{\\frac{\\pi}{2}} = \\frac{1}{2}$'],
		[/∫₀³\s*\(2x\s*\+\s*1\)\s*dx/g, '$\\int_{0}^{3} (2x + 1)\\,dx$'],
		[/∫₁\^e\s*\(1\s*\/\s*x\)\s*dx/g, '$\\int_{1}^{e} \\frac{1}{x}\\,dx$'],
		[/∬_S\s*F\s*·\s*dS/g, '$\\iint_{S} \\mathbf{F} \\cdot d\\mathbf{S}$'],
		[/∮_\{\|z\|=2\}\s*\(1\s*\/\s*z\)\s*dz/g, '$\\oint_{|z|=2} \\frac{1}{z}\\,dz$'],
		[/Σ_\{n=1\}\^∞\s*\(x\^n\)\s*\/\s*\(n\s*·\s*3\^n\)/g, '$\\sum_{n=1}^{\\infty} \\frac{x^n}{n \\cdot 3^n}$'],
		[/Σ_\{n=1\}\^∞\s*\(1\s*\/\s*n²\)/g, '$\\sum_{n=1}^{\\infty} \\frac{1}{n^2}$'],
		[/lim\(x\s*→\s*0\)\s*\[sin\(5x\)\s*\/\s*x\]/g, '$\\lim_{x \\to 0} \\frac{\\sin(5x)}{x}$'],
		[/lim\(u\s*→\s*0\)\s*sin\(u\)\/u\s*=\s*1/g, '$\\lim_{u \\to 0} \\frac{\\sin(u)}{u} = 1$'],
		[/lim\(x\s*→\s*0\)\s*5·sin\(5x\)\/\(5x\)\s*=\s*5/g, '$\\lim_{x \\to 0} \\frac{5\\sin(5x)}{5x} = 5$'],
		[/lim\(x\s*→\s*∞\)\s*\[\(3x²\s*\+\s*5x\s*-\s*1\)\s*\/\s*\(x²\s*-\s*4\)\]/g, '$\\lim_{x \\to \\infty} \\frac{3x^2 + 5x - 1}{x^2 - 4}$'],
		[/lim\s*\|\(x\/\(3\)\)\|\s*=\s*\|x\|\/3\s*<\s*1/g, '$\\lim \\left|\\frac{x}{3}\\right| = \\frac{|x|}{3} < 1$'],
		[/∇²f\s*=\s*∂²f\/∂x²\s*\+\s*∂²f\/∂y²/g, '$\\nabla^2 f = \\frac{\\partial^2 f}{\\partial x^2} + \\frac{\\partial^2 f}{\\partial y^2}$'],
		[/∂²f\/∂x²\s*=\s*2y/g, '$\\frac{\\partial^2 f}{\\partial x^2} = 2y$'],
		[/∂²f\/∂y²\s*=\s*6y/g, '$\\frac{\\partial^2 f}{\\partial y^2} = 6y$'],
		[/∇²f\s*=\s*8y/g, '$\\nabla^2 f = 8y$'],
		[/∂\(x,\s*y\)\/∂\(r,\s*θ\)/g, '$\\frac{\\partial(x, y)}{\\partial(r, \\theta)}$'],
		[/dy\/dx\s*=\s*2xy/g, '$\\frac{dy}{dx} = 2xy$'],
		[/y\(x\)\s*=\s*3e\^\(x²\)/g, '$y(x) = 3e^{x^2}$'],
		[/y\(1\)\s*=\s*3e¹\s*=\s*3e/g, '$y(1) = 3e^1 = 3e$'],
		[/γ\s*=\s*1\s*\/\s*√\(1\s*-\s*v²\/c²\)/g, '$\\gamma = \\frac{1}{\\sqrt{1 - \\frac{v^2}{c^2}}}$'],
		[/u\s*=\s*\(v₁\s*\+\s*v₂\)\s*\/\s*\(1\s*\+\s*v₁v₂\/c²\)/g, '$u = \\frac{v_1 + v_2}{1 + \\frac{v_1 v_2}{c^2}}$'],
		[/E_n\s*=\s*n²π²ℏ²\s*\/\s*\(2mL²\)\s*∝\s*1\/L²/g, '$E_n = \\frac{n^2 \\pi^2 \\hbar^2}{2mL^2} \\propto \\frac{1}{L^2}$'],
		[/λ\s*=\s*h\s*\/\s*p\s*=\s*h\s*\/\s*√\(2mK\)\s*∝\s*1\/√K/g, '$\\lambda = \\frac{h}{p} = \\frac{h}{\\sqrt{2mK}} \\propto \\frac{1}{\\sqrt{K}}$'],
		[/∇\s*·\s*E\s*=\s*ρ\s*\/\s*ε₀/g, '$\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$'],
		[/∇\s*·\s*B\s*=\s*0/g, '$\\nabla \\cdot \\mathbf{B} = 0$'],
		[/∇\s*×\s*E\s*=\s*-∂B\/∂t/g, '$\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}$'],
		[/∇\s*×\s*B\s*=\s*μ₀J\s*\+\s*μ₀ε₀\s*∂E\/∂t/g, '$\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}$'],
		[/1\s*\/\s*√\(LC\)/g, '$\\frac{1}{\\sqrt{LC}}$'],
		[/√\(LC\)/g, '$\\sqrt{LC}$'],
		[/R_s\s*=\s*2GM\/c²/g, '$R_s = \\frac{2GM}{c^2}$'],
		[/v\s*=\s*V_max\s*\[S\]\s*\/\s*\(K_m\s*\+\s*\[S\]\)/g, '$v = \\frac{V_{\\text{max}}[S]}{K_m + [S]}$'],
		[/1\/v\s*=\s*\(K_m\/V_max\)\(1\/\[S\]\)\s*\+\s*1\/V_max/g, '$\\frac{1}{v} = \\frac{K_m}{V_{\\text{max}}}\\frac{1}{[S]} + \\frac{1}{V_{\\text{max}}}$'],
		[/dN\/dt\s*=\s*rN\(1\s*-\s*N\/K\)/g, '$\\frac{dN}{dt} = rN\\left(1 - \\frac{N}{K}\\right)$'],
		[/\bdN\/dt\b/g, '$\\frac{dN}{dt}$'],
		[
			/E_ion\s*≈\s*\(61\s*mV\s*\/\s*z\)\s*log₁₀\(\[ion\]_out\s*\/\s*\[ion\]_in\)/g,
			'$E_{\\text{ion}} \\approx \\frac{61\\text{ mV}}{z}\\log_{10}\\left(\\frac{[\\text{ion}]_{\\text{out}}}{[\\text{ion}]_{\\text{in}}}\\right)$',
		],
		[/E\s*=\s*E°\s*-\s*\(0\.0592\/n\)\s*log₁₀\(Q\)/g, '$E = E^\\circ - \\frac{0.0592}{n}\\log_{10}(Q)$'],
		[/k\s*=\s*A\s*e\^\(-E_a\s*\/\s*RT\)/g, '$k = A e^{-\\frac{E_{\\text{a}}}{RT}}$'],
		[/K_p\s*=\s*K_c\s*\(RT\)\^\(Δn\)/g, '$K_p = K_c (RT)^{\\Delta n}$'],
		[
			/d\s*=\s*√\(\(7\s*-\s*1\)²\s*\+\s*\(10\s*-\s*2\)²\)\s*=\s*√\(36\s*\+\s*64\)\s*=\s*√100\s*=\s*10/g,
			'$d = \\sqrt{(7 - 1)^2 + (10 - 2)^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10$',
		],
		[/\(14\s*-\s*2\)\s*\/\s*\(3\s*-\s*\(-1\)\)/g, '$\\frac{14 - 2}{3 - (-1)}$'],
		[/\(n\s*-\s*2\)\s*×\s*180°\s*\/\s*n/g, '$\\frac{(n - 2) \\times 180^\\circ}{n}$'],
		[/4\s*×\s*180°\s*\/\s*6/g, '$\\frac{4 \\times 180^\\circ}{6}$'],
		[/20\s*×\s*21\s*\/\s*2/g, '$\\frac{20 \\times 21}{2}$'],
		[/n\(n\s*\+\s*1\)\/2/g, '$\\frac{n(n + 1)}{2}$'],
		[
			/\(5\s*×\s*10⁻⁷\s*m\s*×\s*2\.0\s*m\)\s*\/\s*\(2\s*×\s*10⁻⁴\s*m\)/g,
			'$\\frac{5 \\times 10^{-7}\\text{ m} \\times 2.0\\text{ m}}{2 \\times 10^{-4}\\text{ m}}$',
		],
		[/\(1\/4\)\s*\/\s*\(3\/4\)/g, '$\\frac{\\frac{1}{4}}{\\frac{3}{4}}$'],
		[/1\s*\/\s*\(3\/5\)/g, '$\\frac{1}{\\frac{3}{5}}$'],
		[/Δλ\s*=\s*\(h\s*\/\s*m_e\s*c\)\(1\s*-\s*cos\s*θ\)/g, '$\\Delta\\lambda = \\frac{h}{m_{\\text{e}} c}(1 - \\cos\\theta)$'],
		[/2h\s*\/\s*\(m_e\s*c\)/g, '$\\frac{2h}{m_{\\text{e}} c}$'],
		[/h\s*\/\s*\(2m_e\s*c\)/g, '$\\frac{h}{2m_{\\text{e}} c}$'],
		[/h\s*\/\s*\(m_e\s*c\)/g, '$\\frac{h}{m_{\\text{e}} c}$'],
		[/distance\s*\/\s*time\s*=\s*100\s*m\s*\/\s*10\s*s/g, '$\\frac{\\text{distance}}{\\text{time}} = \\frac{100\\text{ m}}{10\\text{ s}}$'],
		[/moles\s*\/\s*liters\s*=\s*2\.0\s*mol\s*\/\s*0\.50\s*L/g, '$\\frac{\\text{moles}}{\\text{liters}} = \\frac{2.0\\text{ mol}}{0.50\\text{ L}}$'],
		[/20\s*N\s*\/\s*4\s*kg/g, '$\\frac{20\\text{ N}}{4\\text{ kg}}$'],
		[/61\s*mV\s*\/\s*1\b/g, '$\\frac{61\\text{ mV}}{1}$'],
		[/61\s*mV\s*\/\s*z\b/g, '$\\frac{61\\text{ mV}}{z}$'],
		[/\|ΔB\s*\/\s*Δt\|/g, '$\\left|\\frac{\\Delta B}{\\Delta t}\\right|$'],
	]

	for (const [pattern, replacement] of exactReplacements) {
		text = applyOutsideDollars(text, pattern, () => replacement)
	}

	// Protect non-division slashes (units and biological/redox pair names) using Private Use Area characters
	// so no alphanumeric/underscore regex can ever collide with them
	const protectedMap: string[] = []
	for (const phrase of NON_DIVISION_SLASH_PHRASES) {
		const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		text = applyOutsideDollars(text, new RegExp(escaped, 'g'), (match) => {
			const idx = protectedMap.length
			protectedMap.push(match)
			return String.fromCharCode(0xe000 + idx)
		})
	}

	// 2. 2x2 matrices
	text = applyOutsideDollars(
		text,
		/det\(\[\[([^\]]+)\],\s*\[([^\]]+)\]\]\)/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)
	text = applyOutsideDollars(
		text,
		/\[\[([^\]]+)\],\s*\[([^\]]+)\]\]/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)

	// 3. Parenthesized divisions first (before standalone √ so expressions like (-1 + √5)/2 stay together)
	text = applyOutsideDollars(
		text,
		/\([^()]+\)[²³⁴]?\s*\/\s*\([^()]+\)[²³⁴]?/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)
	text = applyOutsideDollars(
		text,
		/\([^()]+\)[²³⁴]?\s*\/\s*[a-zA-Z0-9πθλμωℏ°₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻_!]+/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)
	text = applyOutsideDollars(
		text,
		/[a-zA-Z0-9πθλμωℏ°₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻_!]+\s*\/\s*\([^()]+\)[²³⁴]?/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)

	// 4. Square root expressions (with optional division before or after, e.g. √3 / 2, v / √2, v_orb / √2, 1/√r, 1/√K)
	text = applyOutsideDollars(
		text,
		/(?:[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+(?:_[a-zA-Z0-9]+)?\s*\/\s*)?(?:\d+)?√\([^()]+\)(?:\s*\/\s*[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+)?|(?:[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+(?:_[a-zA-Z0-9]+)?\s*\/\s*)?(?:\d+)?√(?:[0-9]+(?:\.[0-9]+)?|[a-zA-Zπ]+)(?:\s*\/\s*[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+)?/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)

	// 5. Caret exponents and braced subscripts: e.g. 3e^(3x), c₁e^(2x), 9^(x), 4^(3/2), 8^(5/3), 2^5, t_{1/2}
	text = applyOutsideDollars(
		text,
		/[a-zA-Z0-9₀₁₂₃₄₅₆₇₈⁹()]+\^\([^()]+\)|[a-zA-Z0-9₀₁₂₃₄₅₆₇₈⁹()]+\^[0-9a-zA-Z+-]+|[a-zA-Z0-9]+_\{[^}]+\}/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)

	// 6. Logarithms and trig functions with fraction arguments: log₂(64), log₁₀([A⁻]/[HA]), ln(V_f / V_i), cos(π/6), sin(π/6)
	text = applyOutsideDollars(
		text,
		/log[₀₁₂₃₄₅₆₇₈₉]+\([^()]+(?:\([^()]*\)[^()]*)*\)/g,
		(m) => {
			const match = m.match(/^log([₀₁₂₃₄₅₆₇₈₉]+)\((.+)\)$/)
			if (!match) return `$${normalizeMathFragmentToLatex(m)}$`
			const sub = convertUnicodeSupSubToLatex(match[1])
			const inner = normalizeMathFragmentToLatex(match[2])
			return `$\\log${sub}\\left(${inner}\\right)$`
		},
	)
	text = applyOutsideDollars(
		text,
		/\b(sin|cos|tan|ln)\(([^()]*\/[^()]*)\)/g,
		(_m, fn: string, inner: string) => {
			return `$\\${fn}\\left(${normalizeMathFragmentToLatex(inner)}\\right)$`
		},
	)

	// 7. Standalone mathematical fractions A / B or A/B (including brackets [A], |k|, subscripts, superscripts, Greek letters, numbers)
	text = applyOutsideDollars(
		text,
		/(?:(?<=^|[\s(,=+-])[-+])?(?:\[[a-zA-Z0-9⁺⁻₀₁₂₃₄₅₆₇₈₉]+\](?:_[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+)?|\|[a-zA-Z0-9πθλμωΔ]+\||[a-zA-Z0-9πθλμωℏΩΔΦΨερτηφζχγαβσ°₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻!]+(?:_\{[^}]+\}|_[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+)?[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻!]*)\s*\/\s*(?:\[[a-zA-Z0-9⁺⁻₀₁₂₃₄₅₆₇₈₉]+\](?:_[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+)?|\|[a-zA-Z0-9πθλμωΔ]+\||[a-zA-Z0-9πθλμωℏΩΔΦΨερτηφζχγαβσ°₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻!]+(?:_\{[^}]+\}|_[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+)?[₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻!]*)/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)

	// 8. Vulgar fraction characters ¼, ½, ¾ outside $...$
	text = applyOutsideDollars(text, /[¼½¾]/g, (m) => `$${normalizeMathFragmentToLatex(m)}$`)

	// 9. Scientific notation: e.g. 3.00 × 10⁸, 1.0 × 10⁻¹⁰
	text = applyOutsideDollars(
		text,
		/\b\d+(?:\.\d+)?\s*×\s*10[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)

	// 10. Trigonometric powers: sin²(θ), cos²(θ)
	text = applyOutsideDollars(
		text,
		/\b(?:sin|cos|tan|sec|csc|cot)[²³⁴]\([a-zA-Z0-9θπ°/+-]+\)/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)

	// 11. Tokens with unicode superscripts or subscripts or _subscripts: e.g. x², 3x², f′(x), y″, t_{1/2}, K_sp, V_max, E°_cell, Cr₂O₇²⁻
	text = applyOutsideDollars(
		text,
		/[a-zA-Z0-9ΔΦΨλμωηχ°]+[′″]*(?:_\{[^}]+\}|_[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉]+|[₀₁₂₃₄₅₆₇₈₉₊₋]+|[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+)+(?:[a-zA-Z0-9₀₁₂₃₄₅₆₇₈₉₊₋⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ]+)*/g,
		(m) => `$${normalizeMathFragmentToLatex(m)}$`,
	)

	// Restore protected non-division slash phrases
	text = text.replace(/[\uE000-\uE0FF]/g, (ch) => {
		const idx = ch.charCodeAt(0) - 0xe000
		const phrase = protectedMap[idx] ?? ''
		return preprocessProtectedPhrase(phrase)
	})

	return text
}

function preprocessProtectedPhrase(phrase: string): string {
	// Still render superscripts/subscripts inside protected unit/chem phrases (like m/s², Na⁺/K⁺, Cu²⁺/Cu, H⁺ / ATP) while keeping their slash intact
	return phrase.replace(
		/[a-zA-Z0-9]+[₀₁₂₃₄₅₆₇₈₉₊₋⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g,
		(m) => `$${convertUnicodeSupSubToLatex(m)}$`,
	)
}

export function renderMathTextToHtml(text: string): string {
	const delimited = preprocessPlainMathToDelimitedLatex(text)
	const tokens = delimited.split(/(\$[^$]+\$)/g)

	return tokens
		.map((token) => {
			if (token.startsWith('$') && token.endsWith('$') && token.length > 2) {
				const rawLatex = token.slice(1, -1)
				try {
					return katex.renderToString(`\\displaystyle ${rawLatex}`, {
						throwOnError: false,
						strict: false,
						displayMode: false,
						output: 'html',
					})
				} catch {
					return escapeHtml(rawLatex)
				}
			}
			return escapeHtml(token)
		})
		.join('')
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

export function MathText({text, className = ''}: MathTextProps) {
	const html = useMemo(() => renderMathTextToHtml(text), [text])
	return (
		<span
			className={`math-text inline leading-relaxed ${className}`}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: Rendered strictly via katex.renderToString and HTML-escaped plain text
			dangerouslySetInnerHTML={{__html: html}}
		/>
	)
}
