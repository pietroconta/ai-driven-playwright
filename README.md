# 🤖 AI-Driven Playwright Test Automation

**Intelligent browser testing powered by GPT-4o** - Write test steps in natural language, let AI generate and execute the Playwright code.

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![Playwright](https://img.shields.io/badge/playwright-1.56.0-orange.svg)](https://playwright.dev)

## ✨ Features

- 🧠 **AI-Powered**: GPT-4o generates Playwright code from natural language descriptions
- 💾 **Smart Caching**: Zero-cost reruns with intelligent code caching
- 🔄 **Auto-Retry**: Configurable retry strategies with error context learning
- 📦 **StepsPacks**: Organize tests into reusable, isolated test suites
- 🎯 **Flexible HTML Cleaning**: Optimize context sent to AI by removing irrelevant elements
- 📊 **Detailed Reporting**: JSON and HTML reports with token usage and cost tracking
- 🔧 **Mock Mode**: Debug workflows without API costs
- ⚡ **Multiple Strength Levels**: Balance reliability vs. cost with onlycache/medium/high modes

## 📋 Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [CLI Options](#-cli-options)
- [How It Works](#-how-it-works)
- [StepsPacks](#-stepspacks)
- [Examples](#-examples)
- [Cost Optimization](#-cost-optimization)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🚀 Installation

### Prerequisites

- Node.js 16+ 
- npm or yarn
- OpenAI API key (Azure OpenAI or standard OpenAI)

### Setup

```bash
# Clone repository
git clone <your-repo-url>
cd pw-ai-smartpeg

# Install dependencies
npm install

# Configure API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### Environment Configuration

Create a `.env` file:

```env
OPENAI_API_KEY=your_azure_openai_key_here
```

## ⚡ Quick Start

### 1. Configure Your Test

Edit `aidriven-settings.json`:

```json
{
  "execution": {
    "entrypoint_url": "https://your-site.com",
    "headless": false,
    "steps_file": "aidriven-steps.json"
  },
  "ai_agent": {
    "type": "gpt-4o",
    "endpoint": "https://your-endpoint.openai.azure.com/openai/deployments/gpt-4o",
    "cost_input_token": "0.000005",
    "cost_output_token": "0.00002",
    "cost_cached_token": "0.0000025"
  }
}
```

### 2. Define Test Steps

Edit `aidriven-steps.json`:

```json
{
  "steps": [
    {
      "sub_prompt": "Click the login button",
      "timeout": "5000"
    },
    {
      "sub_prompt": "Fill username with test@example.com and password with SecurePass123",
      "timeout": "3000"
    },
    {
      "sub_prompt": "Click submit and wait for dashboard",
      "timeout": "8000"
    }
  ]
}
```

### 3. Run Your Test

```bash
# First run (generates cache)
node index.js --strength medium

# Subsequent runs (uses cache, zero cost)
node index.js --strength onlycache

# High reliability mode (3 attempts per step)
node index.js --strength high
```

## ⚙️ Configuration

### Settings File Structure

**aidriven-settings.json**:

| Field | Description | Example |
|-------|-------------|---------|
| `execution.entrypoint_url` | Starting URL for test | `"https://example.com"` |
| `execution.headless` | Run browser in headless mode | `false` |
| `execution.steps_file` | Path to steps JSON | `"aidriven-steps.json"` |
| `ai_agent.type` | AI model to use | `"gpt-4o"` |
| `ai_agent.endpoint` | Azure OpenAI endpoint | `"https://..."` |
| `ai_agent.cost_input_token` | Cost per input token | `"0.000005"` |
| `ai_agent.cost_output_token` | Cost per output token | `"0.00002"` |
| `ai_agent.cost_cached_token` | Cost per cached token | `"0.0000025"` |

### Steps File Structure

**aidriven-steps.json**:

```json
{
  "steps": [
    {
      "id": "73443201",              // Auto-generated hash (optional)
      "sub_prompt": "Your task description in natural language",
      "timeout": "10000"             // Milliseconds to wait after step
    }
  ]
}
```

**Step Fields**:
- `sub_prompt` (required): Natural language description of the action
- `timeout` (optional): Pause duration after step completion (default: 10000ms)
- `id` (auto-generated): MD5 hash used for caching

## 🎛️ CLI Options

### Strength Modes

```bash
--strength <level>
```

| Level | Attempts | Cache | Use Case |
|-------|----------|-------|----------|
| `onlycache` | 1 | Required | Zero-cost reruns of stable tests |
| `medium` | 2 | Preferred | Default balance of cost/reliability |
| `high` | 3 | Preferred | Complex workflows needing retries |

### Additional Flags

```bash
# Disable caching (always generate fresh code)
--nocache

# Mock mode (no API calls, uses hardcoded actions)
--mock

# Use a StepsPack
--stepspack <name>

# Generate HTML report
--html-report

# Stop execution on first error
--stop-on-error

# Customize HTML cleaning
--htmlclean-remove <items>
--htmlclean-keep <items>
```

### HTML Cleaning Options

Control what elements are removed from HTML before sending to AI:

```bash
# Default (recommended)
node index.js

# Remove everything except specific items
--htmlclean-remove all --htmlclean-keep id,class

# Custom cleaning
--htmlclean-remove comments,script,style,svg,img,longtext
```

**Available items**: `comments`, `script`, `style`, `svg`, `img`, `inlinestyle`, `attributes`, `longtext`, `all`

## 🔍 How It Works

### Architecture Overview

```
┌─────────────┐
│   index.js  │  Entry point & CLI
└──────┬──────┘
       │
       ├─► ConfigManager    Load settings & steps
       ├─► CodeGenerator    Generate Playwright code via AI
       ├─► TestExecutor     Execute generated code
       ├─► RetryManager     Handle retry logic
       ├─► TestReporter     Log results & analytics
       └─► TestRunner       Orchestrate execution
```

### Execution Flow

1. **Initialization**
   - Parse CLI arguments
   - Load configuration from settings file
   - Initialize OpenAI client (or MockOpenAI)
   - Configure components with retry/cache strategy

2. **Step Preparation**
   - Read steps from JSON file
   - Generate unique hash ID for each step
   - Validate cache availability (for `onlycache` mode)

3. **Browser Launch**
   - Launch Chromium via Playwright
   - Navigate to entry point URL
   - Wait for initial page load

4. **Step Execution Loop**

   For each step:
   
   **a) Cache Lookup** (if enabled):
   ```javascript
   const cachePath = `./generated/aidriven/step-${hash}.js`;
   // If found → use cached code, skip API call
   ```
   
   **b) AI Code Generation** (if cache miss):
   ```javascript
   // Extract clean HTML from page
   const html = await executor.extractCleanHtml(page);
   
   // Generate code via GPT-4o
   const code = await codeGenerator.generate(step, {
     taskDescription: step.subPrompt,
     url: page.url(),
     html: cleanedHtml,
     errorMessage: previousError // On retry
   });
   ```
   
   **c) Code Execution**:
   ```javascript
   // Wrap in async function with page & expect
   const fn = eval(`(async (page, expect) => { ${code} })`);
   await fn(page, expect);
   ```
   
   **d) Retry Logic**:
   - If failed and attempts remaining: retry with error context
   - High strength: includes previous error in prompt
   - Updates token usage counters
   
   **e) Post-Step Actions**:
   - Log results
   - Wait for configured timeout
   - Proceed to next step

5. **Completion**
   - Close browser
   - Calculate total usage (tokens + cost)
   - Save execution log with analytics
   - Update steps file with generated IDs

### Caching Strategy

```javascript
// Step ID generation (MD5 hash of prompt)
this.id = crypto.createHash("md5")
  .update(subPrompt)
  .digest("hex")
  .slice(0, 8);

// Cache validation (onlycache mode)
if (missingCache.length > 0) {
  console.error("❌ Cache mancante");
  process.exit(1);
}
```

**Cache benefits**:
- Zero API cost on reruns
- Deterministic test behavior
- Faster execution (no AI generation)

## 📦 StepsPacks

Organize tests into isolated, reusable suites with their own configuration.

### Structure

```
stepspacks/
├── my-test-suite/
│   ├── .env                  # Optional: API keys for this pack
│   ├── settings.json         # Pack-specific settings
│   ├── steps.json           # Test steps
│   ├── media/               # Assets (images, files)
│   └── generated/           # Cached code & reports
│       ├── step-*.js
│       └── run-logs.json
```

### Creating a StepsPack

```bash
# Create pack directory
mkdir -p stepspacks/login-flow

# Create settings
cat > stepspacks/login-flow/settings.json << 'EOF'
{
  "execution": {
    "entrypoint_url": "https://myapp.com/login",
    "headless": false
  },
  "ai_agent": {
    "type": "gpt-4o",
    "endpoint": "https://your-endpoint.openai.azure.com/...",
    "cost_input_token": "0.000005",
    "cost_output_token": "0.00002",
    "cost_cached_token": "0.0000025"
  }
}
EOF

# Create steps
cat > stepspacks/login-flow/steps.json << 'EOF'
{
  "steps": [
    {
      "sub_prompt": "Enter email user@example.com",
      "timeout": "3000"
    },
    {
      "sub_prompt": "Enter password SecurePass123 and click login",
      "timeout": "5000"
    }
  ]
}
EOF
```

### Running a StepsPack

```bash
# Execute specific pack
node index.js --stepspack login-flow --strength medium

# With HTML report
node index.js --stepspack login-flow --html-report

# Available packs
ls stepspacks/
# test-livrea  change-image-livrea  guru-valutaz
```

### Benefits

✅ Isolated environments (separate cache, reports, configs)  
✅ Reusable across projects  
✅ Easy to share and version control  
✅ Pack-specific API keys via `.env`

## 🎨 Examples

### Example 1: E-commerce Login Flow

**aidriven-steps.json**:
```json
{
  "steps": [
    {
      "sub_prompt": "Wait for page load, click on the login link in header",
      "timeout": "3000"
    },
    {
      "sub_prompt": "Fill email with user@example.com and password with SecurePass123!",
      "timeout": "2000"
    },
    {
      "sub_prompt": "Click the login submit button",
      "timeout": "5000"
    },
    {
      "sub_prompt": "Verify welcome message contains 'Hello, User'",
      "timeout": "3000"
    }
  ]
}
```

**Execution**:
```bash
# First run (generates cache)
node index.js --strength medium

# Subsequent runs (uses cache, $0.00 cost)
node index.js --strength onlycache
```

### Example 2: Form Automation with Validation

```json
{
  "steps": [
    {
      "sub_prompt": "Navigate to dropdown Analysis > Smart compare",
      "timeout": "5000"
    },
    {
      "sub_prompt": "Select date range 'Last 30 days' from filter",
      "timeout": "3000"
    },
    {
      "sub_prompt": "If the export button is disabled, throw error 'Test failed: Export unavailable', otherwise click it",
      "timeout": "8000"
    },
    {
      "sub_prompt": "Wait for download notification to appear",
      "timeout": "5000"
    }
  ]
}
```

**High reliability run**:
```bash
node index.js --strength high --stop-on-error
```

### Example 3: File Upload Workflow

```json
{
  "steps": [
    {
      "sub_prompt": "Click the three dots menu in profile section",
      "timeout": "3000"
    },
    {
      "sub_prompt": "Click edit photo button with id #btn_modifica_foto",
      "timeout": "4000"
    },
    {
      "sub_prompt": "Click choose file and select /path/to/image.png, wait 3 seconds, then click the enabled save button",
      "timeout": "15000"
    },
    {
      "sub_prompt": "Verify success message appears",
      "timeout": "5000"
    }
  ]
}
```

### Example 4: Conditional Logic

```json
{
  "steps": [
    {
      "sub_prompt": "If banner is visible, accept it by clicking Accept button",
      "timeout": "3000"
    },
    {
      "sub_prompt": "If text 'Non sono presenti funzioni extra' is found, throw error 'Test failed: No extra features available', otherwise click QUESTIONARIO ONLINE",
      "timeout": "10000"
    }
  ]
}
```

## 💰 Cost Optimization

### Best Practices

#### 1. Use Cache Aggressively

```bash
# First run (generates cache)
node index.js --strength medium

# All subsequent runs (zero cost)
node index.js --strength onlycache
```

**Savings**: 100% cost reduction on reruns

#### 2. Start with Medium Strength

- Default `--strength medium` balances cost and reliability (2 attempts)
- Only use `--strength high` (3 attempts) for problematic workflows
- Reserve `--strength onlycache` for stable tests

#### 3. Optimize HTML Cleaning

Remove unnecessary HTML to reduce token usage:

```bash
# Aggressive cleaning (smallest context)
node index.js --htmlclean-remove all --htmlclean-keep id,class,data-testid

# Default (balanced)
node index.js --htmlclean-remove comments,script,style,svg,img,longtext
```

#### 4. Monitor Token Usage

Check `run-logs.json` after execution:

```json
{
  "usage": {
    "total_tokens": 12450,
    "input_tokens": 10000,
    "output_tokens": 2000,
    "cached_tokens": 8500,
    "calculated_cost": 0.0375
  }
}
```

**Cached tokens** are 50% cheaper - Azure OpenAI automatically caches repeated prompt content.

#### 5. Optimize Prompts

✅ **Good**: Concise and specific
```json
{
  "sub_prompt": "Click login button with id #btn_login"
}
```

❌ **Bad**: Overly verbose
```json
{
  "sub_prompt": "Please locate the login button on the page, which should be somewhere near the top of the form, and when you find it, click on it to proceed to the next step"
}
```

### Cost Example

**Scenario**: 10-step workflow, ~1000 tokens per step

| Mode | API Calls | Total Tokens | Cached | Cost |
|------|-----------|--------------|--------|------|
| `onlycache` | 0 | 0 | N/A | **$0.00** ✨ |
| `medium` (all cached) | 0 | 0 | N/A | **$0.00** ✨ |
| `medium` (no cache) | 10 | 20,000 | 5,000 | **$0.40** |
| `high` (2 retries) | 12 | 24,000 | 6,000 | **$0.48** |

**Recommendation**: Always run `medium` first to build cache, then use `onlycache` for CI/CD pipelines.

## 🐛 Troubleshooting

### Common Issues

#### 1. "Cache file not found" in onlycache mode

```bash
❌ ERRORE: Cache mancante per i seguenti step:
   - Step 1: "Click login button"
     File atteso: ./generated/aidriven/step-aa9c1054.js

💡 Suggerimento: Esegui prima con --strength medium o --strength high
```

**Solution**:
```bash
# Generate cache first
node index.js --strength medium

# Then use onlycache
node index.js --strength onlycache
```

#### 2. "Element not found" errors

**Causes**:
- Page not fully loaded
- Dynamic selectors changed
- Element is hidden/inactive

**Solutions**:
1. Increase `timeout` value:
   ```json
   {
     "sub_prompt": "Click submit button",
     "timeout": "10000"  // Increase from 5000
   }
   ```

2. Try `--strength high` for retry with error context:
   ```bash
   node index.js --strength high
   ```

3. Clear cache if page structure changed:
   ```bash
   node index.js --nocache --strength medium
   ```

4. Check generated code:
   ```bash
   cat ./generated/aidriven/step-{hash}.js
   ```

#### 3. Token/Cost calculation incorrect

**Check**:
- Verify `cost_*_token` values in settings
- Review `run-logs.json` for token breakdown
- Ensure cached tokens counted correctly

#### 4. Incompatible options error

```bash
--strength onlycache e --nocache sono opzioni incompatibili
```

**Solution**: Don't combine `--strength onlycache` with `--nocache`

#### 5. Test fails with "Test failed:" message

This indicates the AI deliberately threw an error based on your conditional logic:

```json
{
  "sub_prompt": "If error message appears, throw error 'Test failed: Login unsuccessful'"
}
```

This is **expected behavior** - check your step conditions.

### Debugging Workflow

1. **Enable Mock Mode** (no API costs):
   ```bash
   node index.js --mock
   ```

2. **Check Generated Code**:
   ```bash
   cat ./generated/aidriven/step-{hash}.js
   ```

3. **Review Execution Log**:
   ```bash
   cat ./generated/aidriven/run-logs.json | jq '.runs[-1]'
   ```

4. **Run in Headed Mode**:
   ```json
   {
     "execution": {
       "headless": false
     }
   }
   ```

5. **Force Fresh Generation**:
   ```bash
   node index.js --nocache --strength high
   ```

6. **Inspect HTML Sent to AI**:
   ```bash
   cat ./generated/aidriven/debug/post-clean/1.html
   ```

## 🔒 Security Considerations

⚠️ **Important Security Notes**:

- **Never commit `.env`** file with real API keys
- **Use `.gitignore`** to exclude sensitive files (already configured)
- **Avoid hardcoding credentials** in step prompts:

  ```json
  // ❌ Bad
  {
    "sub_prompt": "Login with password: MySecret123"
  }
  
  // ✅ Better
  {
    "sub_prompt": "Login with credentials from environment"
  }
  ```

- **Review generated code** before running on production systems
- **Use headless mode cautiously** on public sites
- **Sanitize logs** before sharing (may contain sensitive selectors)
- **Rotate API keys** regularly
- **Use StepsPack `.env`** files for isolated credentials

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

### Planned Features

- [ ] Environment variable injection in prompts (`${PROCESS.ENV.USERNAME}`)
- [ ] Parallel step execution for independent tests
- [ ] Visual regression testing integration
- [ ] Multiple browser support (Firefox, Safari, WebKit)
- [ ] Web UI for step configuration
- [ ] CI/CD integration examples (GitHub Actions, GitLab CI)
- [ ] Step dependency system (`depends_on: ["step-1", "step-2"]`)
- [ ] Conditional step execution based on results
- [ ] Screenshot capture on failure
- [ ] Video recording of test runs
- [ ] Playwright trace integration

### How to Contribute

1. **Fork the repository**
2. **Create feature branch**: 
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit changes**: 
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to branch**: 
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open Pull Request** with detailed description

### Development Setup

```bash
# Install dependencies
npm install

# Run linter
npm run lint

# Run tests
npm test
```

## 📄 License

This project is licensed under the ISC License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [**Playwright**](https://playwright.dev/) - Reliable browser automation framework
- [**OpenAI GPT-4o**](https://openai.com/) - AI code generation capabilities
- [**Azure OpenAI**](https://azure.microsoft.com/products/ai-services/openai-service) - Enterprise AI service
- [**Commander.js**](https://github.com/tj/commander.js) - CLI argument parsing
- [**JSDOM**](https://github.com/jsdom/jsdom) - HTML parsing and cleaning
<<<<<<< HEAD

---

## 📞 Support

For issues, feature requests, or questions:

- 📧 Open an issue on GitHub
- 💬 Check existing issues for solutions
- 📖 Review this README and inline documentation

---

**Happy Automating! 🚀**
=======