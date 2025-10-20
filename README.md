# 🤖 AI-Driven Playwright Automation

An intelligent browser automation tool that uses OpenAI's GPT-4o to generate and execute Playwright code dynamically based on natural language instructions, with advanced caching and retry strategies.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Execution Modes](#execution-modes)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Cost Optimization](#cost-optimization)
- [Security Considerations](#security-considerations)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

This project combines the power of AI with browser automation to create a system that can understand natural language commands and translate them into executable Playwright code. Instead of writing complex automation scripts manually, you simply describe what you want to do, and the AI generates and executes the appropriate code.

**Key Concept**: You provide high-level instructions like "Click the login button" or "Fill in the username and password fields", and the AI analyzes the current page's HTML structure to generate precise Playwright code that accomplishes the task.

**Intelligence Levels**: The system supports three execution strategies:
- **onlycache**: Lightning-fast execution using only pre-generated code (zero API costs)
- **medium**: Balanced approach with cache fallback and one API retry (cost-effective)
- **high**: Maximum reliability with cache, API generation, and error-correcting retries

## ✨ Features

- **🧠 AI-Powered Code Generation**: Uses OpenAI GPT-4o to generate Playwright code from natural language
- **💾 Intelligent Caching System**: 
  - Automatic code caching based on prompt hash
  - Cache-first execution for zero-cost reruns
  - Selective cache bypass with `--nocache` flag
- **⚡ Multiple Strength Levels**:
  - `--strength onlycache`: Execute only from cache (fastest, zero API cost)
  - `--strength medium`: Cache + 1 API call (balanced, default)
  - `--strength high`: Cache + 2 API calls with error correction (most reliable)
- **🔄 Smart Retry Logic**: Automatic retry with error context for failed steps
- **🎭 Mock Mode**: Test workflows without API calls using `--mock` flag
- **📊 Detailed Cost Tracking**: Real-time token usage and cost calculation
- **💰 Token Usage Analytics**:
  - Input/output token breakdown
  - Cached token tracking
  - Calculated costs per execution
- **📁 Code Persistence**: All generated code saved with unique hash-based IDs
- **🔍 Context-Aware**: AI analyzes current page HTML for accurate selectors
- **🎯 Headless/Headed Support**: Run browser automation visibly or in background

## 🔧 Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **OpenAI API Key** (with Azure OpenAI endpoint access)
- Basic understanding of browser automation concepts

## 📦 Installation

1. **Clone the repository**:
```bash
git clone https://github.com/pietroconta/ai-playwright-automation.git
cd ai-playwright-automation
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp .env.example .env
```

4. **Configure your OpenAI API key** in `.env`:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

## ⚙️ Configuration

### Main Settings File: `aidriven-settings.json`

```json
{
  "execution": {
    "entrypoint_url": "https://your-website.com/",
    "headless": false,
    "steps_file": "aidriven-steps.json"
  },
  "ai_agent": {
    "type": "gpt-4o",
    "endpoint": "https://your-azure-endpoint.openai.azure.com/openai/deployments/gpt-4o",
    "cost_input_token": "0.000005",
    "cost_output_token": "0.00002",
    "cost_cached_token": "0.0000025"
  }
}
```

**Parameters**:
- `execution.entrypoint_url`: The starting URL for your automation
- `execution.headless`: `true` for background execution, `false` to see the browser
- `execution.steps_file`: Path to the JSON file containing automation steps
- `ai_agent.endpoint`: Your Azure OpenAI endpoint URL
- `ai_agent.cost_*_token`: Token pricing for cost calculation

### Steps Configuration: `aidriven-steps.json`

```json
{
  "steps": [
    {
      "id": "aa9c1054",
      "sub_prompt": "Click the login button",
      "timeout": "5000"
    },
    {
      "id": "66e265a6",
      "sub_prompt": "Enter username: user@example.com and password: myPassword123",
      "timeout": "5000"
    }
  ]
}
```

**Step Properties**:
- `id`: Auto-generated hash based on `sub_prompt` (for caching)
- `sub_prompt`: Natural language description of the action to perform
- `timeout`: Milliseconds to wait after completing this step (default: 10000)

## 🚀 Usage

### Basic Execution (Medium Strength)

```bash
node index.js
```

This uses the default `--strength medium` mode: cache-first with one API fallback.

### Cache-Only Execution (Fastest, Zero Cost)

```bash
node index.js --strength onlycache
```

**Perfect for**:
- CI/CD pipelines with pre-generated steps
- Regression testing with stable workflows
- Production environments where speed is critical

**Note**: Fails if any step's cache is missing. Run with `medium` or `high` first to generate cache.

### High-Reliability Execution

```bash
node index.js --strength high
```

**Features**:
- Cache lookup first
- First API call if cache misses
- Second API call with error context if first attempt fails
- Best for complex or unstable workflows

### Disable Caching

```bash
node index.js --nocache
```

Forces fresh code generation for all steps. Useful when:
- Page structure has changed
- Testing new prompts
- Debugging cached code issues

### Mock Mode (Debug Without API Costs)

```bash
node index.js --mock
```

Uses hardcoded responses from `aidriven-settings.mock.json` for testing.

### Combined Options

```bash
# High reliability without using cache
node index.js --strength high --nocache

# Mock mode with high reliability simulation
node index.js --mock --strength high
```

## 🎮 Execution Modes

| Mode | Cache Lookup | API Calls | Use Case | Cost |
|------|--------------|-----------|----------|------|
| `onlycache` | ✅ | ❌ | CI/CD, stable flows | **$0** |
| `medium` | ✅ | 1 max | Default, balanced | **Low** |
| `high` | ✅ | 2 max | Complex/unreliable sites | **Medium** |
| `--nocache` | ❌ | Per strength | Testing, debugging | **Varies** |
| `--mock` | N/A | 0 (simulated) | Development | **$0** |

### Strength Level Behavior

```javascript
// onlycache
Step.maxAttempts = 1;  // Only cache lookup
Step.cacheFirst = true;

// medium
Step.maxAttempts = 2;  // Cache, then 1 API call
Step.cacheFirst = true;

// high
Step.maxAttempts = 3;  // Cache, then 2 API calls (2nd with error context)
Step.cacheFirst = true;
```

## 📁 Project Structure

```
ai-playwright-automation/
├── index.js                      # Main orchestration logic
├── models/
│   └── step.js                   # Step class with caching & retry logic
├── mock-openai.js                # Mock OpenAI client for testing
├── aidriven-settings.json        # Main configuration
├── aidriven-settings.mock.json   # Mock mode configuration
├── aidriven-steps.json           # Production step definitions
├── aidriven-steps.mock.json      # Mock step definitions
├── generated/
│   └── aidriven/
│       ├── step-{hash}.js        # Generated code (cached)
│       └── run-log.json          # Execution results with cost data
├── .env                          # Environment variables (API keys)
├── .env.example                  # Template for environment variables
├── .gitignore                    # Git ignore patterns
├── package.json                  # Dependencies
└── README.md                     # This file
```

## 🔍 How It Works

### 1. **Initialization**
- Parses CLI arguments (`--strength`, `--nocache`, `--mock`)
- Loads configuration from `aidriven-settings.json`
- Initializes OpenAI client (or MockOpenAI)
- Configures `Step` class with retry/cache strategy

### 2. **Step Preparation**
- Reads steps from configured JSON file
- Generates unique hash ID for each step (based on prompt)
- Validates cache availability (for `onlycache` mode)
- Initializes Step objects with retry counters

### 3. **Browser Launch**
- Launches Chromium browser using Playwright
- Navigates to entry point URL
- Waits for DOM content to load

### 4. **Step Execution Loop**

For each step:

1. **Cache Lookup** (if enabled):
   - Checks `./generated/aidriven/step-{hash}.js`
   - If found and valid, uses cached code
   - Skips API call entirely

2. **AI Code Generation** (if cache miss or `--nocache`):
   - Retrieves current page HTML body
   - Sends prompt + HTML to GPT-4o
   - On retry with `--strength high`: includes previous error message
   - Saves generated code to cache file

3. **Code Execution**:
   - Wraps code in async function with `page` and `expect`
   - Evaluates and executes on live browser
   - Tracks success/failure

4. **Retry Logic**:
   - If failed and attempts remaining: retry
   - High strength: second attempt includes error context
   - Updates token usage counters

5. **Post-Step Actions**:
   - Logs results to console
   - Waits for configured timeout
   - Proceeds to next step

### 5. **Completion**
- Closes browser
- Calculates total usage (tokens + cost)
- Saves execution log with analytics
- Updates steps file with IDs

### Caching Strategy

```javascript
// Step ID generation (MD5 hash of prompt)
this.id = crypto.createHash("md5")
  .update(subPrompt)
  .digest("hex")
  .slice(0, 8);

// Cache path
const cachePath = `./generated/aidriven/step-${step.id}.js`;

// Cache validation (onlycache mode)
if (missingCache.length > 0) {
  console.error("❌ ERRORE: Cache mancante");
  process.exit(1);
}
```

## 🎨 Examples

### Example 1: E-commerce Login Flow

**Configuration** (`aidriven-steps.json`):
```json
{
  "steps": [
    {
      "id": "f8e9a7b2",
      "sub_prompt": "Wait for page load, click on the login link in header",
      "timeout": "3000"
    },
    {
      "id": "c4d5e6f7",
      "sub_prompt": "Fill email with user@example.com and password with SecurePass123!",
      "timeout": "2000"
    },
    {
      "id": "a1b2c3d4",
      "sub_prompt": "Click the login submit button",
      "timeout": "5000"
    }
  ]
}
```

**First Run** (generates cache):
```bash
node index.js --strength medium
```

**Subsequent Runs** (uses cache):
```bash
node index.js --strength onlycache
```

### Example 2: Form Automation with High Reliability

```json
{
  "steps": [
    {
      "id": "12ab34cd",
      "sub_prompt": "Navigate to dropdown Analysis > Smart compare",
      "timeout": "5000"
    },
    {
      "id": "56ef78gh",
      "sub_prompt": "Select date range 'Last 30 days' from filter",
      "timeout": "3000"
    },
    {
      "id": "90ij12kl",
      "sub_prompt": "Click export button and wait for download",
      "timeout": "8000"
    }
  ]
}
```

**Execution**:
```bash
node index.js --strength high
```

### Example 3: Mock Testing Workflow

**aidriven-settings.mock.json**:
```json
{
  "execution": {
    "entrypoint_url": "https://test-site.example.com/",
    "headless": true,
    "steps_file": "aidriven-steps.mock.json"
  },
  "hc_code": "await page.click('#testButton'); console.log('Mock action executed');"
}
```

**Run**:
```bash
node index.js --mock --strength medium
```

## 🐛 Troubleshooting

### Common Issues

**1. "Cache file not found" in onlycache mode**
```bash
❌ ERRORE: Cache mancante per i seguenti step:
   - Step 1: "Click login button"
     File atteso: ./generated/aidriven/step-aa9c1054.js

💡 Suggerimento: Esegui prima con --strength medium o --strength high
```

**Solution**: Generate cache first:
```bash
node index.js --strength medium
```

**2. "Element not found" errors**
- Increase `timeout` value in step configuration
- Try `--strength high` for retry with error context
- Clear cache with `--nocache` if page structure changed
- Check generated code in `./generated/aidriven/step-*.js`

**3. Token/Cost calculation seems wrong**
- Verify `ai_agent.cost_*_token` values in settings
- Check `run-log.json` for detailed token breakdown
- Ensure cached tokens are counted correctly

**4. Incompatible options error**
```bash
--strength onlycache e --nocache sono opzioni incompatibili
```
**Solution**: Don't combine `--strength onlycache` with `--nocache`.

### Debugging Workflow

1. **Enable Mock Mode**:
   ```bash
   node index.js --mock
   ```
   Test logic without API costs.

2. **Check Generated Code**:
   ```bash
   cat ./generated/aidriven/step-{hash}.js
   ```

3. **Review Execution Log**:
   ```bash
   cat ./generated/aidriven/run-log.json
   ```

4. **Run in Headed Mode**:
   Set `"headless": false` in settings to watch execution.

5. **Force Fresh Generation**:
   ```bash
   node index.js --nocache --strength high
   ```

## 💰 Cost Optimization

### Best Practices

1. **Use Cache Aggressively**:
   ```bash
   # First run (generates cache)
   node index.js --strength medium
   
   # All subsequent runs (zero cost)
   node index.js --strength onlycache
   ```

2. **Start with Medium Strength**:
   - Default `--strength medium` balances cost and reliability
   - Only use `--strength high` for problematic workflows

3. **Monitor Token Usage**:
   ```json
   // From run-log.json
   {
     "usage": {
       "total_token": 12450,
       "input_token": 10000,
       "output_token": 2000,
       "cached_token": 8500,
       "calculated_cost": 0.0375
     }
   }
   ```

4. **Leverage Cached Tokens**:
   - Azure OpenAI caches prompt content
   - 50% cost reduction on repeated prompts
   - Automatically tracked in `cached_token` field

5. **Optimize Prompts**:
   - Be concise but specific
   - Avoid overly complex instructions in single step
   - Break complex actions into smaller steps

### Cost Example

**Scenario**: 10-step workflow, each step ~1000 tokens

| Mode | API Calls | Total Tokens | Cached | Cost |
|------|-----------|--------------|--------|------|
| onlycache | 0 | 0 | N/A | **$0.00** |
| medium (all cached) | 0 | 0 | N/A | **$0.00** |
| medium (no cache) | 10 | 20,000 | 5,000 | **$0.40** |
| high (2 fails) | 12 | 24,000 | 6,000 | **$0.48** |

## 🔒 Security Considerations

- **Never commit `.env`** file with real API keys
- **Avoid hardcoding credentials** in step prompts
  ```json
  // Bad
  "sub_prompt": "Login with password: MySecret123"
  
  // Better (use env variables in future version)
  "sub_prompt": "Login with credentials from environment"
  ```
- **Review generated code** before running on production systems
- **Use headless mode cautiously** on public sites
- **Sanitize logs** before sharing (may contain sensitive selectors)

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

### Planned Features
- [ ] Environment variable injection in prompts
- [ ] Parallel step execution
- [ ] Visual regression testing
- [ ] Multiple browser support (Firefox, Safari)
- [ ] Web UI for step configuration
- [ ] CI/CD integration examples
- [ ] Step dependency system
- [ ] Conditional step execution

### How to Contribute

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- [Playwright](https://playwright.dev/) - Browser automation framework
- [OpenAI](https://openai.com/) - AI code generation (GPT-4o)
- [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service) - Enterprise AI service
- [Commander.js](https://github.com/tj/commander.js) - CLI argument parsing

---

**Happy Automating! 🚀**

*For issues, feature requests, or questions, please open an issue on GitHub.*