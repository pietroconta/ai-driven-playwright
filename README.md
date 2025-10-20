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