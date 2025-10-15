# 🤖 AI-Driven Playwright Automation

An intelligent browser automation tool that uses OpenAI's GPT-4 to generate and execute Playwright code dynamically based on natural language instructions.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

This project combines the power of AI with browser automation to create a system that can understand natural language commands and translate them into executable Playwright code. Instead of writing complex automation scripts manually, you simply describe what you want to do, and the AI generates and executes the appropriate code.

**Key Concept**: You provide high-level instructions like "Click the login button" or "Fill in the username and password fields", and the AI analyzes the current page's HTML structure to generate precise Playwright code that accomplishes the task.

## ✨ Features

- **🧠 AI-Powered Code Generation**: Uses OpenAI GPT-4o to generate Playwright code from natural language
- **🔄 Two Execution Modes**:
  - **Config Mode**: Read automation steps from JSON configuration files
  - **Interactive Mode**: Define steps dynamically through CLI prompts
- **📊 Detailed Logging**: Comprehensive execution logs with success/error tracking
- **💾 Code Persistence**: All generated Playwright code is saved for review and debugging
- **🎭 Headless/Headed Support**: Run browser automation visibly or in the background
- **⚡ Step-by-Step Execution**: Each action is performed sequentially with configurable timeouts
- **🔍 Context-Aware**: AI analyzes the current page HTML to generate accurate selectors

## 🔧 Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **OpenAI API Key** (with Azure OpenAI endpoint access)
- Basic understanding of browser automation concepts

## 📦 Installation

1. **Clone the repository**:
```bash
git clone https://github.com/yourusername/ai-playwright-automation.git
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
    }
}
```

**Parameters**:
- `entrypoint_url`: The starting URL for your automation
- `headless`: `true` for background execution, `false` to see the browser
- `steps_file`: Path to the JSON file containing automation steps

### Steps Configuration: `aidriven-steps.json`

```json
{
    "steps": [
        {
            "sub_prompt": "Click the login button",
            "timeout": 5000
        },
        {
            "sub_prompt": "Enter username: user@example.com and password: myPassword123",
            "timeout": 5000
        },
        {
            "sub_prompt": "Navigate to the dashboard",
            "timeout": 5000
        }
    ]
}
```

**Step Properties**:
- `sub_prompt`: Natural language description of the action to perform
- `timeout`: Milliseconds to wait after completing this step (default: 10000)

## 🚀 Usage

### Config Mode (Default)

Use predefined steps from JSON configuration:

```bash
node index.js
```

or explicitly:

```bash
node index.js --mode config
```

### Interactive Mode

Define steps dynamically through CLI:

```bash
node index.js --mode interactive
```

You'll be prompted to enter:
1. The starting URL
2. A comma-separated list of actions to perform

**Example Interactive Session**:
```
Inserisci l'URL iniziale: https://example.com
Descrivi le azioni: click login, enter username admin, enter password secret, click submit
```

## 📁 Project Structure

```
ai-playwright-automation/
├── index.js                    # Main entry point and orchestration logic
├── models/
│   └── step.js                # Step class with logging functionality
├── aidriven-settings.json     # Main configuration file
├── aidriven-steps.json        # Step definitions for config mode
├── generated/
│   └── aidriven/             # AI-generated Playwright code and logs
│       ├── step1.js          # Generated code for step 1
│       ├── step2.js          # Generated code for step 2
│       └── run-log.json      # Execution results log
├── .env                       # Environment variables (API keys)
├── .env.example              # Template for environment variables
├── .gitignore                # Git ignore patterns
├── package.json              # Node.js dependencies and scripts
└── README.md                 # This file
```

## 🔍 How It Works

### 1. **Initialization**
- Loads configuration from `aidriven-settings.json`
- Parses execution mode from command-line arguments
- Initializes OpenAI client with Azure endpoint

### 2. **Step Preparation**
- **Config Mode**: Reads steps from `aidriven-steps.json`
- **Interactive Mode**: Prompts user for URL and actions

### 3. **Browser Launch**
- Launches Chromium browser using Playwright
- Navigates to the specified entry point URL
- Waits for DOM content to load

### 4. **Step Execution Loop**

For each step:

1. **Context Capture**: Retrieves current page HTML
2. **AI Code Generation**:
   - Sends natural language prompt + page HTML to GPT-4o
   - AI analyzes the page structure and generates Playwright code
   - Code is saved to `./generated/aidriven/stepX.js`
3. **Code Execution**:
   - Generated code is evaluated and executed on the live page
   - Uses the existing `page` object (no new browser instances)
4. **Logging**:
   - Success/failure is logged to console
   - Results are stored in memory for final report
5. **Pause**: Waits for configured timeout before next step

### 5. **Completion**
- Closes browser
- Saves execution log to `./generated/aidriven/run-log.json`
- Displays summary of results

## 🎨 Examples

### Example 1: E-commerce Login and Checkout

**Configuration** (`aidriven-steps.json`):
```json
{
    "steps": [
        {
            "sub_prompt": "Click on the login link in the header",
            "timeout": 3000
        },
        {
            "sub_prompt": "Fill in email field with user@example.com",
            "timeout": 2000
        },
        {
            "sub_prompt": "Fill in password field with MySecurePass123!",
            "timeout": 2000
        },
        {
            "sub_prompt": "Click the login submit button",
            "timeout": 5000
        },
        {
            "sub_prompt": "Search for 'wireless headphones' in the search bar",
            "timeout": 3000
        },
        {
            "sub_prompt": "Click on the first product in the results",
            "timeout": 3000
        },
        {
            "sub_prompt": "Click add to cart button",
            "timeout": 2000
        }
    ]
}
```

### Example 2: Form Submission

**Interactive Mode**:
```bash
node index.js --mode interactive

# When prompted:
URL: https://example.com/contact
Actions: fill name with John Doe, fill email with john@example.com, fill message with Test message, click submit
```

### Example 3: Data Extraction

```json
{
    "steps": [
        {
            "sub_prompt": "Navigate to the reports section",
            "timeout": 3000
        },
        {
            "sub_prompt": "Select 'Last 30 Days' from the date filter",
            "timeout": 2000
        },
        {
            "sub_prompt": "Click the export CSV button",
            "timeout": 5000
        }
    ]
}
```

## 🐛 Troubleshooting

### Common Issues

**1. "OpenAI API Key not found"**
- Ensure `.env` file exists with `OPENAI_API_KEY=your_key`
- Verify the key is valid and has access to the Azure OpenAI endpoint

**2. "Element not found" errors**
- Increase the `timeout` value for the previous step
- Check if the page requires additional wait conditions
- Verify the AI-generated selector in `./generated/aidriven/stepX.js`

**3. Browser doesn't open in Interactive Mode**
- Set `"headless": false` in `aidriven-settings.json`
- Check Playwright installation: `npx playwright install chromium`

**4. Code generation takes too long**
- Large HTML pages slow down AI processing
- Consider simplifying your prompts
- Check OpenAI API rate limits

### Debugging Tips

1. **Review Generated Code**: Check `./generated/aidriven/stepX.js` files to see what the AI generated
2. **Enable Headed Mode**: Set `headless: false` to watch automation in real-time
3. **Check Logs**: Review `./generated/aidriven/run-log.json` for execution details
4. **Simplify Steps**: Break complex actions into smaller, atomic steps

## 🔒 Security Considerations

- **Never commit `.env`** file with real API keys
- **Avoid hardcoding credentials** in step prompts (use environment variables instead)
- **Be cautious** when running in headless mode on production sites
- **Review generated code** before running on sensitive systems

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Areas for Improvement

- [ ] Add support for multiple browsers (Firefox, Safari)
- [ ] Implement retry logic for failed steps
- [ ] Add visual regression testing capabilities
- [ ] Create a web UI for step configuration
- [ ] Support for parallel execution
- [ ] Integration with CI/CD pipelines

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Playwright](https://playwright.dev/) - Browser automation framework
- [OpenAI](https://openai.com/) - AI code generation
- [Commander.js](https://github.com/tj/commander.js) - CLI argument parsing


**Happy Automating! 🚀**
