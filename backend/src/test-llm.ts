import 'dotenv/config';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const testPrompt = 'こんにちは。簡単なテストです。「テスト成功」と返答してください。';

async function testOpenAI() {
  console.log('\n=== OpenAI テスト ===');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY が設定されていません');
    return false;
  }
  
  console.log('API Key: ' + apiKey.substring(0, 7) + '***...');
  
  try {
    const openai = createOpenAI({ apiKey });
    // gpt-5.2 最新モデル
    const model = openai('gpt-5.2');
    
    console.log('モデル: gpt-5.2');
    console.log('リクエスト送信中...');
    
    const result = await generateText({
      model,
      prompt: testPrompt,
    });
    
    console.log('✅ 成功!');
    console.log('応答:', result.text.substring(0, 100));
    return true;
  } catch (error) {
    console.log('❌ エラー:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function testGemini() {
  console.log('\n=== Gemini テスト ===');
  
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey || apiKey === 'your-google-api-key') {
    console.log('❌ GOOGLE_GENERATIVE_AI_API_KEY が設定されていません');
    return false;
  }
  
  console.log('API Key: ' + apiKey.substring(0, 7) + '***...');
  
  try {
    const google = createGoogleGenerativeAI({ apiKey });
    // gemini-3-flash-preview 最新モデル
    const model = google('gemini-3-flash-preview');
    
    console.log('モデル: gemini-3-flash-preview');
    console.log('リクエスト送信中...');
    
    const result = await generateText({
      model,
      prompt: testPrompt,
    });
    
    console.log('✅ 成功!');
    console.log('応答:', result.text.substring(0, 100));
    return true;
  } catch (error) {
    console.log('❌ エラー:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('LLM 接続テスト');
  console.log('========================================');
  
  console.log('\n環境変数の確認:');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '設定済み' : '未設定');
  console.log('GOOGLE_GENERATIVE_AI_API_KEY:', process.env.GOOGLE_GENERATIVE_AI_API_KEY ? '設定済み' : '未設定');
  
  const results: Record<string, boolean> = {};
  
  results.openai = await testOpenAI();
  results.gemini = await testGemini();
  
  console.log('\n========================================');
  console.log('テスト結果サマリー');
  console.log('========================================');
  console.log('OpenAI:', results.openai ? '✅ 成功' : '❌ 失敗');
  console.log('Gemini:', results.gemini ? '✅ 成功' : '❌ 失敗');
}

main().catch(console.error);
