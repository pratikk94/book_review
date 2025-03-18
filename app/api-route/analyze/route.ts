import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFileSync } from "fs";
import { join } from "path";
import { default as pdfParse } from "pdf-parse";
import OpenAI from "openai";
import { parse } from "json2csv";

// Make sure OpenAI API key is set
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing. Please add it to your environment variables.");
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create the public directory if it doesn't exist
const publicDir = join(process.cwd(), 'public');
try {
  mkdir(publicDir, { recursive: true }, (err) => {
    if (err) console.error('Error creating public directory:', err);
  });
} catch (error) {
  console.error('Error initializing directory:', error);
}

export async function POST(req: NextRequest) {
  console.log("API route hit: /api-route/analyze");
  
  try {
    // Parse the form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.log("No file uploaded");
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log("File received:", file.name, file.size);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Parse PDF
    let pdfData;
    try {
      pdfData = await pdfParse(buffer);
    } catch (error) {
      console.error("Error parsing PDF:", error);
      return NextResponse.json({ error: "Failed to parse PDF file" }, { status: 400 });
    }
    
    const text = pdfData.text;
    console.log("Text extracted, length:", text.length);

    // Create OpenAI prompt
    const prompt = `
    Analyze the following eBook based on these 10 parameters. Rate each on a scale of 1-10 and provide justification:
    
    1. Readability Score
    2. Content Originality & Plagiarism Detection
    3. Sentiment Analysis
    4. Keyword Density & Topic Relevance
    5. Writing Style & Grammar Check
    6. Structure & Formatting Quality
    7. Engagement & Readability Flow
    8. Complexity & Technical Depth
    9. Named Entity Recognition (NER) & Topic Categorization
    10. Summary & Key Insights Generation

    Text:
    ${text.slice(0, 5000)}

    Provide the output in JSON format as:
    [
      { "Parameter": "Readability Score", "Score": 8, "Justification": "Clear and well-structured sentences." },
      { "Parameter": "Content Originality & Plagiarism Detection", "Score": 7, "Justification": "Mostly original but some common phrases detected." }
    ]
    `;

    console.log("Calling OpenAI API");
    
    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    console.log("OpenAI response received");
    
    const analysis = JSON.parse(response.choices[0]?.message?.content || "[]");

    // Generate CSV
    const csvData = parse(analysis);
    const csvPath = join(publicDir, 'report.csv');
    
    // Write CSV to file
    try {
      writeFileSync(csvPath, csvData);
      console.log("CSV file created:", csvPath);
    } catch (error) {
      console.error("Error writing CSV file:", error);
      return NextResponse.json({ error: "Failed to create CSV report" }, { status: 500 });
    }

    // Return result
    return NextResponse.json({ analysis, downloadLink: "/report.csv" });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 });
  }
} 