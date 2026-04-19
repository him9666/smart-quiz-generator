import { OpenAI } from 'openai';
import pdfParse from 'pdf-parse';
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

function parseResponseText(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('AI response did not contain valid JSON.');
  }
  return JSON.parse(match[0]) as {
    quiz: string;
    feedback: string;
    suggestions: string;
  };
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const pdfFile = formData.get('pdf') as File | null;
  const title = String(formData.get('title') ?? 'Study notes');

  if (!pdfFile || !pdfFile.size) {
    return NextResponse.json({ error: 'Please upload a PDF file.' }, { status: 400 });
  }

  const arrayBuffer = await pdfFile.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const pdfData = await pdfParse(fileBuffer);
  const text = (pdfData.text || '').trim();

  if (!text) {
    return NextResponse.json({ error: 'Unable to parse the uploaded PDF.' }, { status: 400 });
  }

  const contentHash = crypto.createHash('sha256').update(text).digest('hex');

  const { data: cachedData, error: cacheError } = await supabaseAdmin
    .from('notes')
    .select('quiz_response')
    .eq('content_hash', contentHash)
    .limit(1)
    .single();

  if (cacheError && cacheError.code !== 'PGRST116') {
    console.error('Supabase cache lookup error:', cacheError);
  }

  if (cachedData?.quiz_response) {
    return NextResponse.json(cachedData.quiz_response);
  }

  const fileName = `${Date.now()}-${pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error: uploadError } = await supabaseAdmin.storage.from('notes').upload(fileName, fileBuffer, {
    contentType: pdfFile.type || 'application/pdf',
  });

  if (uploadError) {
    console.error('Supabase upload error:', uploadError);
    return NextResponse.json({ error: 'Failed to upload PDF to Supabase.' }, { status: 500 });
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from('notes').getPublicUrl(fileName);
  const fileUrl = publicUrlData?.publicUrl;

  const openAi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `You are a smart quiz generator. Use the extracted notes below to generate a quiz, student feedback, and improvement suggestions.

Title: ${title}

Notes content:
${text}

Return only valid JSON with the keys: quiz, feedback, suggestions.
- quiz: generate at least 6 multiple-choice questions with 4 answer options each. Include the correct answer and a short explanation for every question.
- feedback: one paragraph explaining the note quality, coverage, and clarity.
- suggestions: three clear ways the student can improve or expand the notes.
`;

  const completion = await openAi.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You generate quizzes and learning improvement feedback from student notes.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.5,
  });

  const responseText = completion.choices?.[0]?.message?.content ?? '';

  if (!responseText) {
    return NextResponse.json({ error: 'OpenAI returned an empty response.' }, { status: 500 });
  }

  let parsed;
  try {
    parsed = parseResponseText(responseText);
  } catch (error) {
    console.error('OpenAI parse error:', error, 'raw:', responseText);
    return NextResponse.json({ error: 'Unable to parse the AI response.' }, { status: 500 });
  }

  const record = {
    file_name: pdfFile.name,
    file_key: fileName,
    content_hash: contentHash,
    extracted_text: text,
    quiz_response: parsed,
  };

  const { error: upsertError } = await supabaseAdmin.from('notes').upsert(record, {
    onConflict: 'content_hash',
  });

  if (upsertError) {
    console.error('Supabase upsert error:', upsertError);
  }

  return NextResponse.json({ ...parsed, fileUrl });
}
