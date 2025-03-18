# eBook AI Analyzer

A powerful tool for analyzing eBooks and PDF documents using AI. This application leverages OpenAI's GPT-4 to provide comprehensive analysis of PDF content.

## Features

- Upload and analyze PDF eBooks
- AI-powered content analysis based on 10 different parameters
- Detailed scoring with justifications for each parameter
- Book summary and prologue generation
- CSV report download functionality
- Modern, responsive UI with animations

## Technical Stack

- **Frontend**: Next.js, React, Ant Design
- **Backend**: Next.js API Routes
- **AI**: OpenAI GPT-4
- **PDF Processing**: pdf-parse

## Getting Started

### Prerequisites

- Node.js 18+ installed
- OpenAI API key

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd ebook-ai-analyzer
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env.local` file in the root directory with your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

4. Start the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application

## How It Works

1. Upload a PDF document through the UI
2. The file is processed by the backend API
3. The text is extracted from the PDF
4. The content is analyzed by OpenAI's GPT-4
5. Results are displayed in a clean, interactive interface
6. Download the analysis as a CSV file

## License

MIT 