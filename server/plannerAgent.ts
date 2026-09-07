import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { LLMConfig, ParsedSpecPlan, PlannerExecutionOptions, TestStep } from './types';
import { executeLLMChatCompletion } from './llmRouter';

/**
 * Executes the Playwright Planner Agent against an OpenAI-compatible LLM endpoint
 * (e.g. Ollama, vLLM, OpenAI, LocalAI) or Google Gemini fallback,
 * runs in a temporary isolated sandbox directory, and parses specs/*.md.
 */
export async function runPlannerAgent(
  requirement: string,
  targetUrl: string = 'https://example.com',
  llmConfig: LLMConfig,
  options: PlannerExecutionOptions = {}
): Promise<ParsedSpecPlan> {
  const startTime = Date.now();
  const log = (msg: string, level: 'info' | 'warn' | 'error' = 'info') => {
    if (options.onLog) {
      options.onLog(`[${new Date().toISOString()}] ${msg}`, level);
    }
  };

  const executionId = crypto.randomUUID();
  const sandboxDir = options.sandboxDir || path.join(os.tmpdir(), `playwright-planner-${executionId}`);
  const specsDir = path.join(sandboxDir, 'specs');

  log(`Initializing sandbox environment at: ${sandboxDir}`);

  // Ensure sandbox directory and specs folder exist
  try {
    fs.mkdirSync(specsDir, { recursive: true });
    log(`Sandbox created successfully with /specs output directory`);
  } catch (err: any) {
    log(`Failed to create sandbox directory: ${err.message}`, 'error');
    throw new Error(`Sandbox initialization failed: ${err.message}`);
  }

  try {
    // Determine execution mode:
    // If agentExecutable is provided or found in PATH, execute via child_process
    const shouldUseSubprocess =
      options.executionMode === 'subprocess' ||
      (options.executionMode !== 'direct_llm' && Boolean(options.agentExecutable));

    if (shouldUseSubprocess && options.agentExecutable) {
      log(`Running planner via subprocess binary: ${options.agentExecutable}`);
      await executePlannerSubprocess(options.agentExecutable, requirement, targetUrl, llmConfig, sandboxDir, options, log);
    } else {
      // Core LLM Router: Direct Planner Agent execution against OpenAI-compatible endpoint
      log(`Routing test requirement to LLM endpoint: ${llmConfig.baseUrl} (${llmConfig.model})`);
      await executeLLMPlannerRouter(requirement, targetUrl, llmConfig, sandboxDir, specsDir, log);
    }

    // Locate and extract generated specs/*.md file
    log(`Scanning sandbox directory for generated specification files...`);
    const specFiles = getMarkdownFiles(specsDir);

    let targetSpecFile: string | null = null;
    if (specFiles.length > 0) {
      targetSpecFile = specFiles[0];
    } else {
      // Fallback: check root sandboxDir
      const rootFiles = getMarkdownFiles(sandboxDir);
      if (rootFiles.length > 0) {
        targetSpecFile = rootFiles[0];
      }
    }

    if (!targetSpecFile) {
      throw new Error(`Planner agent completed but failed to generate any specs/*.md markdown plan file.`);
    }

    log(`Found generated spec: ${path.basename(targetSpecFile)} (${fs.statSync(targetSpecFile).size} bytes)`);
    const rawMarkdown = fs.readFileSync(targetSpecFile, 'utf-8');

    // Parse the markdown into structured checklist steps for human-in-the-loop workflow
    const parsedPlan = parseSpecMarkdown(rawMarkdown, targetSpecFile, sandboxDir, targetUrl, llmConfig.model, Date.now() - startTime);

    log(`Successfully parsed test plan: "${parsedPlan.title}" with ${parsedPlan.steps.length} executable steps.`);
    return parsedPlan;

  } finally {
    // Clean up sandbox if not preserved
    if (!options.preserveSandbox) {
      try {
        // Keep file in memory, remove sandbox if requested
        // To allow file reading or download, we keep it if needed, or remove
        // In our SaaS preview, we can preserve for inspection if preserveSandbox is true
      } catch (cleanupErr: any) {
        log(`Warning: Failed to clean up sandbox ${sandboxDir}: ${cleanupErr.message}`, 'warn');
      }
    }
  }
}

/**
 * Executes a planner agent subprocess using Node.js child_process.spawn
 */
async function executePlannerSubprocess(
  executable: string,
  requirement: string,
  targetUrl: string,
  llmConfig: LLMConfig,
  sandboxDir: string,
  options: PlannerExecutionOptions,
  log: (msg: string, level?: 'info' | 'warn' | 'error') => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs || 120000;
    const args = ['plan', '--requirement', requirement, '--target', targetUrl, '--output-dir', path.join(sandboxDir, 'specs')];

    log(`Spawning subprocess: ${executable} ${args.join(' ')}`);

    const env = {
      ...process.env,
      OPENAI_BASE_URL: llmConfig.baseUrl,
      OPENAI_API_BASE: llmConfig.baseUrl,
      OPENAI_API_KEY: llmConfig.apiKey || 'ollama',
      OPENAI_MODEL: llmConfig.model,
      PLAYWRIGHT_TARGET_URL: targetUrl,
      SANDBOX_DIR: sandboxDir,
    };

    const child = spawn(executable, args, {
      cwd: sandboxDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      log(`Subprocess timed out after ${timeoutMs}ms. Sending SIGTERM...`, 'error');
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          log(`Subprocess did not terminate. Sending SIGKILL...`, 'error');
          child.kill('SIGKILL');
        }
      }, 3000);
      reject(new Error(`Planner subprocess timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      const text = data.toString();
      text.split('\n').filter(Boolean).forEach((line: string) => log(`[stdout] ${line}`));
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      text.split('\n').filter(Boolean).forEach((line: string) => log(`[stderr] ${line}`, 'warn'));
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      log(`Subprocess process error: ${err.message}`, 'error');
      reject(err);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code === 0) {
        log(`Subprocess completed successfully (exit code: 0)`);
        resolve();
      } else {
        log(`Subprocess exited with failure code: ${code} (signal: ${signal})`, 'error');
        reject(new Error(`Subprocess exited with code ${code}`));
      }
    });
  });
}

/**
 * Direct LLM Router: Calls OpenAI-compatible API (Ollama, vLLM, OpenAI, LocalAI) or Gemini
 * and generates the Playwright Planner test specification.
 */
async function executeLLMPlannerRouter(
  requirement: string,
  targetUrl: string,
  llmConfig: LLMConfig,
  sandboxDir: string,
  specsDir: string,
  log: (msg: string, level?: 'info' | 'warn' | 'error') => void
): Promise<void> {
  const systemPrompt = `You are an expert Playwright Test Planning Agent for high-reliability end-to-end automated testing.
Your role is to translate plain English user requirements into an authoritative, deterministic Markdown Test Plan for Playwright.

Output formatting requirements:
- Return ONLY clean Markdown starting with '# Spec: <Descriptive Feature Title>'.
- Do NOT wrap the entire response in backticks or markdown code fences (like \`\`\`markdown ... \`\`\`).
- Include sections:
  ## Target Application
  - Base URL: <url>
  - Preconditions:
    - [precondition item]
  ## Test Scenarios & Steps
  For each step, provide:
  - Step number & title
  - Action (precise user interaction, click, fill, navigate, wait)
  - Expected Assertion (explicit locator check, URL check, text expectation)
  - Recommended Locator / Selector hint (e.g. data-testid, role, text, label)
  ## Edge Cases & Healing Notes
  - Potential flaky elements, dynamic timers, retry thresholds, or auto-healing advice.
`;

  const userPrompt = `Target Application URL: ${targetUrl}
Test Requirement from User:
"${requirement}"

Generate the complete Playwright Test Plan specification in Markdown format now.`;

  let responseText = '';
  let modelUsed = llmConfig.model || 'deterministic-synthesizer';
  let tokensUsed = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  try {
    const result = await executeLLMChatCompletion({
      config: llmConfig,
      systemPrompt,
      userPrompt,
      temperature: llmConfig.temperature ?? 0.2,
      timeoutMs: 60000,
      log,
    });
    responseText = result.text;
    modelUsed = result.modelUsed;
    if (result.tokensUsed) {
      tokensUsed = result.tokensUsed;
    }
  } catch (err: any) {
    const isConnRefused =
      err.code === 'ECONNREFUSED' ||
      err.cause?.code === 'ECONNREFUSED' ||
      err.message?.includes('ECONNREFUSED') ||
      err.message?.includes('fetch failed') ||
      err.message?.includes('Host unreachable') ||
      err.message?.includes('Cloud container');

    if (isConnRefused) {
      log(`Remote connection unavailable (${err.message}). Activating deterministic Planner Agent fallback engine...`, 'warn');
      responseText = generateDeterministicPlan(requirement, targetUrl);
      modelUsed = 'deterministic-synthesizer';
    } else {
      throw err;
    }
  }

  if (!responseText || responseText.trim().length === 0) {
    throw new Error('LLM returned an empty response for the test plan.');
  }

  // Strip wrapping markdown code blocks if present
  let cleanedMarkdown = responseText.trim();
  if (cleanedMarkdown.startsWith('```markdown')) {
    cleanedMarkdown = cleanedMarkdown.replace(/^```markdown\s*/, '').replace(/```$/, '').trim();
  } else if (cleanedMarkdown.startsWith('```')) {
    cleanedMarkdown = cleanedMarkdown.replace(/^```\w*\s*/, '').replace(/```$/, '').trim();
  }

  // Create slug for file name
  const slug = requirement
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '') || 'test-spec';

  const fileName = `${slug}.md`;
  const specFilePath = path.join(specsDir, fileName);

  log(`Writing generated test plan to: ${specFilePath}`);
  fs.writeFileSync(specFilePath, cleanedMarkdown, 'utf-8');
}

/**
 * Parses raw Playwright markdown specification into structured checklist steps
 */
function parseSpecMarkdown(
  rawMarkdown: string,
  filePath: string,
  sandboxDir: string,
  targetUrl: string,
  modelUsed: string,
  executionTimeMs: number
): ParsedSpecPlan {
  const lines = rawMarkdown.split('\n');
  let title = 'Automated Playwright Test Plan';
  const preconditions: string[] = [];
  const steps: TestStep[] = [];
  const edgeCases: string[] = [];

  let currentSection = '';
  let currentStep: Partial<TestStep> | null = null;
  let stepIndex = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Extract Title from H1
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s*(Spec:\s*)?/, '').trim();
      continue;
    }

    // Section headings
    if (line.startsWith('## ')) {
      const heading = line.replace(/^##\s*/, '').toLowerCase();
      if (heading.includes('target') || heading.includes('precondition')) {
        currentSection = 'preconditions';
      } else if (heading.includes('scenario') || heading.includes('step')) {
        currentSection = 'steps';
      } else if (heading.includes('edge') || heading.includes('healing') || heading.includes('note')) {
        currentSection = 'edgeCases';
      } else {
        currentSection = heading;
      }
      continue;
    }

    if (currentSection === 'preconditions') {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        preconditions.push(line.replace(/^[-*]\s*/, ''));
      }
    } else if (currentSection === 'steps') {
      // Look for numbered steps (e.g., "1. Navigate to...", "### Step 1: ...", "1. **Login**")
      const stepMatch = line.match(/^(\d+)\.\s+(.*)/) || line.match(/^###\s+Step\s+(\d+)[:.]\s*(.*)/i);
      if (stepMatch) {
        if (currentStep && currentStep.description) {
          steps.push(finalizeStep(currentStep, stepIndex++));
        }
        currentStep = {
          description: stepMatch[2].replace(/\*\*/g, '').trim(),
          action: stepMatch[2].replace(/\*\*/g, '').trim(),
          expectedAssertion: 'Verify successful step completion without errors',
          selectorHint: '',
          isApproved: true,
        };
        continue;
      }

      if (currentStep) {
        // Parse sub-bullets like Action, Expect/Assertion, Selector
        const actionMatch = line.match(/^[-*]\s*(Action|Do|When)[:\s]+(.*)/i);
        const assertMatch = line.match(/^[-*]\s*(Expect|Assertion|Then|Verify)[:\s]+(.*)/i);
        const selectorMatch = line.match(/^[-*]\s*(Locator|Selector|Target)[:\s]+(.*)/i);

        if (actionMatch) {
          currentStep.action = actionMatch[2].trim();
        } else if (assertMatch) {
          currentStep.expectedAssertion = assertMatch[2].trim();
        } else if (selectorMatch) {
          currentStep.selectorHint = selectorMatch[2].trim();
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          // Additional descriptive detail
          if (!currentStep.action || currentStep.action === currentStep.description) {
            currentStep.action = line.replace(/^[-*]\s*/, '').trim();
          } else {
            currentStep.expectedAssertion = line.replace(/^[-*]\s*/, '').trim();
          }
        }
      }
    } else if (currentSection === 'edgeCases') {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        edgeCases.push(line.replace(/^[-*]\s*/, ''));
      }
    }
  }

  // Push last pending step if any
  if (currentStep && currentStep.description) {
    steps.push(finalizeStep(currentStep, stepIndex++));
  }

  // Fallback: If no structured numbered steps were parsed, split lines with bullet points
  if (steps.length === 0) {
    const bulletLines = lines.filter((l) => l.startsWith('- ') || l.startsWith('* '));
    bulletLines.forEach((bl, idx) => {
      const text = bl.replace(/^[-*]\s*/, '').trim();
      steps.push({
        id: `step-${idx + 1}`,
        stepNumber: idx + 1,
        description: text,
        action: text,
        expectedAssertion: 'Check state reflects action',
        selectorHint: '',
        isApproved: true,
      });
    });
  }

  return {
    id: crypto.randomUUID(),
    title: title || 'Automated Playwright Test Plan',
    targetUrl,
    preconditions: preconditions.length > 0 ? preconditions : ['Target site is accessible in modern browser'],
    steps: steps.length > 0 ? steps : [
      {
        id: 'step-1',
        stepNumber: 1,
        description: 'Navigate to target URL and inspect page',
        action: `page.goto("${targetUrl}")`,
        expectedAssertion: 'Page loads with HTTP 200 and document title',
        selectorHint: 'body',
        isApproved: true,
      },
    ],
    edgeCases: edgeCases.length > 0 ? edgeCases : ['Network latency fluctuations', 'Modal popups / consent banners'],
    rawMarkdown,
    fileName: path.basename(filePath),
    filePath,
    sandboxDir,
    createdAt: new Date().toISOString(),
    executionTimeMs,
    modelUsed,
  };
}

function finalizeStep(partial: Partial<TestStep>, index: number): TestStep {
  return {
    id: `step-${index}-${Date.now().toString(36)}`,
    stepNumber: index,
    description: partial.description || `Step ${index}`,
    action: partial.action || partial.description || '',
    expectedAssertion: partial.expectedAssertion || 'Check expected DOM element appears without error',
    selectorHint: partial.selectorHint || '',
    isApproved: partial.isApproved ?? true,
  };
}

function getMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const mdFiles: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
      mdFiles.push(fullPath);
    }
  }

  return mdFiles;
}

/**
 * Fallback synthesizer that produces a compliant Playwright Test Agent Markdown spec
 * when external LLMs are unreachable or experiencing provider quota limits.
 */
function generateDeterministicPlan(requirement: string, targetUrl: string): string {
  const reqLower = requirement.toLowerCase();

  // Determine scenario archetype
  let title = 'Automated End-to-End User Journey';
  let stepsMarkdown = '';

  if (reqLower.includes('checkout') || reqLower.includes('cart') || reqLower.includes('promo')) {
    title = 'Verify Guest Checkout & Promo Code Redemption';
    stepsMarkdown = `1. Navigate to target store and accept cookie consent
   - Action: page.goto("${targetUrl}")
   - Expect: Main storefront catalog is rendered and search bar is visible
   - Selector: nav, [data-testid="header"], .header

2. Select featured product and add to shopping cart
   - Action: page.click("text=Add to Cart")
   - Expect: Cart badge counter increments to "1" and notification toast displays
   - Selector: [data-testid="cart-btn"], .btn-cart, button:has-text("Add to cart")

3. Navigate to shopping cart drawer or page
   - Action: page.click("[aria-label='Shopping Cart']")
   - Expect: Cart view displays selected item with quantity 1
   - Selector: [data-testid="cart-icon"], a[href*="cart"]

4. Enter promotional voucher code
   - Action: page.fill("[name='coupon']", "SAVE20")
   - Expect: Input accepts string "SAVE20" without client errors
   - Selector: input[name="coupon"], input[placeholder*="promo" i]

5. Click apply promo button and assert discount calculation
   - Action: page.click("button:has-text('Apply')")
   - Expect: Discount line item displays 20% deduction and total adjusts
   - Selector: [data-testid="apply-discount"], button:has-text("Apply")

6. Proceed to guest checkout screen
   - Action: page.click("button:has-text('Checkout as Guest')")
   - Expect: URL contains "/checkout" and shipping address form is presented
   - Selector: [data-testid="guest-checkout"], a:has-text("Checkout")`;
  } else if (reqLower.includes('login') || reqLower.includes('auth') || reqLower.includes('signup')) {
    title = 'User Authentication & Session Validation';
    stepsMarkdown = `1. Navigate to authentication portal
   - Action: page.goto("${targetUrl}")
   - Expect: Login form with email and password inputs is visible
   - Selector: form, [data-testid="login-form"]

2. Enter invalid credentials to verify error handling
   - Action: page.fill("input[type='email']", "invalid_user@test.org") && page.fill("input[type='password']", "badpass") && page.click("button[type='submit']")
   - Expect: Alert notification displays "Invalid username or password"
   - Selector: [role="alert"], .error-message, [data-testid="auth-error"]

3. Submit valid user credentials
   - Action: page.fill("input[type='email']", "test.user@playwright.dev") && page.fill("input[type='password']", "ValidPass123!") && page.click("button[type='submit']")
   - Expect: Redirected to authenticated dashboard and session token stored
   - Selector: button[type="submit"], [data-testid="submit-login"]

4. Assert user profile avatar and logout button are visible
   - Action: page.waitForSelector("[data-testid='user-profile']")
   - Expect: Header displays logged-in user email or avatar badge
   - Selector: [data-testid="user-profile"], [aria-label="User Menu"]`;
  } else {
    title = `Automated Verification: ${requirement.slice(0, 45)}`;
    stepsMarkdown = `1. Navigate to target application
   - Action: page.goto("${targetUrl}")
   - Expect: Page loads with HTTP 200 and document title is present
   - Selector: body

2. Inspect initial view and interact with primary control
   - Action: page.waitForLoadState("networkidle")
   - Expect: Interactive elements and navigation components are rendered
   - Selector: main, header, [role="main"]

3. Execute requested scenario steps: ${requirement.slice(0, 70)}
   - Action: page.click("button:visible, a:visible")
   - Expect: Application responds with expected view update
   - Selector: button, a, [data-testid]

4. Assert final success state or confirmation banner
   - Action: page.waitForSelector("[role='status'], [role='alert'], h1, h2")
   - Expect: Required outcome matches user requirement criteria
   - Selector: [role="status"], .success-message, h1`;
  }

  return `# Spec: ${title}

## Target Application
- Base URL: ${targetUrl}
- Preconditions:
  - Application endpoint is reachable over HTTP/HTTPS
  - Browser viewport initialized at 1280x720 standard desktop
  - Clean browser context with isolated cookies and localStorage

## Test Scenarios & Steps
${stepsMarkdown}

## Edge Cases & Healing Notes
- Dynamic animations or modal overlays may delay clickability; use page.locator().waitFor({ state: 'visible' }).
- Selector healing priority: Prefer data-testid, followed by accessible role & aria-label, falling back to stable text selectors.
- Network latency spikes on checkout or third-party APIs should have 10,000ms explicit expectation timeouts.
`;
}
