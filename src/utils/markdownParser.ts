import { TestStep, ParsedSpecPlan } from '../types';

export interface PlanValidationResult {
  isValid: boolean;
  warnings: string[];
  stats: {
    totalSteps: number;
    approvedSteps: number;
    stepsWithAssertions: number;
    stepsWithSelectors: number;
    wordCount: number;
    charCount: number;
  };
}

/**
 * Parses markdown text into structured test plan fields (title, preconditions, steps, edgeCases)
 */
export function parseMarkdownToPlan(
  rawMarkdown: string,
  targetUrl: string,
  existingSteps: TestStep[] = []
): {
  title: string;
  preconditions: string[];
  steps: TestStep[];
  edgeCases: string[];
} {
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

    // Title from H1
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s*(Spec:\s*|Playwright Test Plan:\s*)?/i, '').trim();
      continue;
    }

    // Section headings
    if (line.startsWith('## ')) {
      const heading = line.replace(/^##\s*/, '').toLowerCase();
      if (heading.includes('target') || heading.includes('precondition') || heading.includes('setup')) {
        currentSection = 'preconditions';
      } else if (heading.includes('scenario') || heading.includes('step') || heading.includes('flow')) {
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
        const item = line.replace(/^[-*]\s*/, '').trim();
        if (item) preconditions.push(item);
      }
    } else if (currentSection === 'steps') {
      // Step number detection: 1. ... or ### Step 1: ... or - Step 1: ...
      const stepMatch =
        line.match(/^(\d+)\.\s+(.*)/) ||
        line.match(/^###\s+Step\s+(\d+)[:.]\s*(.*)/i) ||
        line.match(/^[-*]\s+\*\*Step\s+(\d+)[:.]?\*\*\s*(.*)/i);

      if (stepMatch) {
        if (currentStep && currentStep.description) {
          steps.push(finalizeStep(currentStep, stepIndex++, existingSteps));
        }

        const rawDesc = (stepMatch[2] || stepMatch[1] || '').replace(/\*\*/g, '').trim();
        currentStep = {
          description: rawDesc || `Step ${stepIndex}`,
          action: rawDesc || '',
          expectedAssertion: '',
          selectorHint: '',
          isApproved: true,
        };
        continue;
      }

      if (currentStep) {
        const actionMatch = line.match(/^[-*]\s*(?:Action|Do|When|Execute)[:\s]+(.*)/i);
        const assertMatch = line.match(/^[-*]\s*(?:Expect|Assertion|Then|Verify|Validate)[:\s]+(.*)/i);
        const selectorMatch = line.match(/^[-*]\s*(?:Locator|Selector|Target|Element)[:\s]+(.*)/i);

        if (actionMatch) {
          currentStep.action = actionMatch[1].trim();
        } else if (assertMatch) {
          currentStep.expectedAssertion = assertMatch[1].trim();
        } else if (selectorMatch) {
          currentStep.selectorHint = selectorMatch[1].trim();
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          const detail = line.replace(/^[-*]\s*/, '').trim();
          if (!currentStep.action || currentStep.action === currentStep.description) {
            currentStep.action = detail;
          } else if (!currentStep.expectedAssertion) {
            currentStep.expectedAssertion = detail;
          }
        }
      }
    } else if (currentSection === 'edgeCases') {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const item = line.replace(/^[-*]\s*/, '').trim();
        if (item) edgeCases.push(item);
      }
    }
  }

  // Finalize last step
  if (currentStep && currentStep.description) {
    steps.push(finalizeStep(currentStep, stepIndex++, existingSteps));
  }

  // Fallback if no numbered steps found
  if (steps.length === 0) {
    const bulletLines = lines.filter((l) => l.startsWith('- ') || l.startsWith('* '));
    bulletLines.forEach((bl, idx) => {
      const text = bl.replace(/^[-*]\s*/, '').trim();
      const existing = existingSteps[idx];
      steps.push({
        id: existing?.id || `step-${idx + 1}`,
        stepNumber: idx + 1,
        description: text,
        action: text,
        expectedAssertion: 'Verify user interface responds and renders expected state',
        selectorHint: '',
        isApproved: existing ? existing.isApproved : true,
      });
    });
  }

  return {
    title: title || 'Automated Playwright Test Plan',
    preconditions: preconditions.length > 0 ? preconditions : ['Target application is reachable and ready'],
    steps: steps.length > 0 ? steps : [],
    edgeCases: edgeCases.length > 0 ? edgeCases : [],
  };
}

function finalizeStep(
  partial: Partial<TestStep>,
  stepNumber: number,
  existingSteps: TestStep[]
): TestStep {
  // Preserve approval state from existing step with same stepNumber or description
  const existing = existingSteps.find(
    (e) => e.stepNumber === stepNumber || e.description === partial.description
  );

  return {
    id: existing?.id || `step-${stepNumber}-${Date.now().toString().slice(-4)}`,
    stepNumber,
    description: partial.description || `Step ${stepNumber}`,
    action: partial.action || partial.description || 'Perform user interaction',
    expectedAssertion:
      partial.expectedAssertion || 'Verify DOM element state updates as expected',
    selectorHint: partial.selectorHint || '',
    isApproved: existing ? existing.isApproved : true,
  };
}

/**
 * Converts structured plan objects back to a clean Playwright Markdown specification
 */
export function convertPlanToMarkdown(
  title: string,
  targetUrl: string,
  preconditions: string[],
  steps: TestStep[],
  edgeCases: string[]
): string {
  const parts: string[] = [];

  // H1 Title
  parts.push(`# Spec: ${title.trim() || 'Playwright Test Plan'}`);
  parts.push('');

  // Target URL & Scope
  parts.push('## Target URL & Environment');
  parts.push(`- **Target URL**: ${targetUrl}`);
  parts.push(`- **Generated At**: ${new Date().toISOString()}`);
  parts.push(`- **Scope**: End-to-End browser test automation`);
  parts.push('');

  // Preconditions
  parts.push('## Preconditions');
  if (preconditions.length > 0) {
    preconditions.forEach((p) => parts.push(`- ${p}`));
  } else {
    parts.push('- Browser viewport set to standard desktop (1280x720)');
    parts.push(`- Target application reachable at ${targetUrl}`);
  }
  parts.push('');

  // Test Scenarios / Steps
  parts.push('## Test Scenarios & Step Sequence');
  steps.forEach((step, idx) => {
    parts.push(`### Step ${idx + 1}: ${step.description}`);
    parts.push(`- **Action**: ${step.action || step.description}`);
    if (step.selectorHint) {
      parts.push(`- **Selector**: \`${step.selectorHint}\``);
    }
    parts.push(`- **Expectation**: ${step.expectedAssertion || 'Verify element is visible'}`);
    parts.push(`- **Status**: ${step.isApproved ? 'Approved' : 'Excluded'}`);
    parts.push('');
  });

  // Edge Cases & Healing Notes
  parts.push('## Edge Cases & Self-Healing Guidelines');
  if (edgeCases.length > 0) {
    edgeCases.forEach((ec) => parts.push(`- ${ec}`));
  } else {
    parts.push('- Prefer data-testid or user-visible text over brittle CSS paths.');
    parts.push('- Use waitForLoadState("networkidle") or web assertions like expect(locator).toBeVisible() for async operations.');
  }
  parts.push('');

  return parts.join('\n');
}

/**
 * Validates a test plan and checks assertion coverage and step counts
 */
export function validatePlan(steps: TestStep[], rawMarkdown: string): PlanValidationResult {
  const warnings: string[] = [];

  if (steps.length === 0) {
    warnings.push('No test execution steps detected in specification.');
  }

  const stepsWithoutAssertions = steps.filter(
    (s) => !s.expectedAssertion || s.expectedAssertion.trim() === ''
  );
  if (stepsWithoutAssertions.length > 0) {
    warnings.push(
      `${stepsWithoutAssertions.length} step(s) have no explicit assertion (verification check).`
    );
  }

  const approvedSteps = steps.filter((s) => s.isApproved).length;
  if (approvedSteps === 0 && steps.length > 0) {
    warnings.push('All steps are currently toggled off. At least one approved step is required.');
  }

  if (!rawMarkdown.includes('## Preconditions') && !rawMarkdown.includes('Preconditions')) {
    warnings.push('Markdown lacks a "## Preconditions" section.');
  }

  const wordCount = rawMarkdown.trim().split(/\s+/).filter(Boolean).length;
  const stepsWithSelectors = steps.filter((s) => Boolean(s.selectorHint?.trim())).length;

  return {
    isValid: warnings.length === 0,
    warnings,
    stats: {
      totalSteps: steps.length,
      approvedSteps,
      stepsWithAssertions: steps.length - stepsWithoutAssertions.length,
      stepsWithSelectors,
      wordCount,
      charCount: rawMarkdown.length,
    },
  };
}
