
import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { catchError, map, Observable, of} from "rxjs";
import {Chroma} from 'langchain/vectorstores';
import {Document} from 'langchain/document';
import {OpenAIEmbeddings} from 'langchain/embeddings/openai';


import * as os from 'os';
import * as openai from 'openai';
import * as tiktoken from 'tiktoken';
import re from 're';
import {TiktokenEncoding} from 'tiktoken';
import * as path from 'path';
import * as fs from 'fs';
import {OpenAI} from 'openai';

os.environ['OPENAI_API_KEY'] = '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';


// class bcolors {
//     static HEADER = '\033[95m';
//     static OKBLUE = '\033[94m';
//     static OKCYAN = '\033[96m';
//     static OKGREEN = '\033[92m';
//     static WARNING = '\033[93m';
//     static FAIL = '\033[91m';
//     static ENDC = '\033[0m';
//     static BOLD = '\033[1m';
//     static UNDERLINE = '\033[4m';
// }

class WorkerOpenAI {
    private apiKey: string;
    private model: string;
    private chat_manager_system: string;
    private source_chunks: Document[];
    private search_index: Chroma;
    private docs: Document[];
    private message_content: string;

    clientChatGpt = new OpenAI({ apiKey: this.configService.get('GPT_API') });
    constructor(chat_manager_system = " ", persistDirectory = null, mod = 'gpt-3.5-turbo-0301', private readonly configService: ConfigService) {
        const sourceChunks: Document[] = [];
        this.model = mod;
        this.chat_manager_system = chat_manager_system;
        this.apiKey = this.configService.get('GPT_API');

        if (persistDirectory) {
            console.log("Используем готовую базу данных. Путь: ", persistDirectory);
            this.search_index = new Chroma({ persistDirectory: persistDirectory, embeddingFunction: OpenAIEmbeddings() });
        }
    }

    create_embedding(doc_dir = "/content/drive/", persistDirectory = ""): void {
        function num_tokens_from_string(string: string, encodingName: TiktokenEncoding): number {
            const encoding = tiktoken.get_encoding(encodingName);
            const num_tokens = encoding.encode(string).length;
            return num_tokens;
        }

        this.source_chunks = [];
        const splitter = new RecursiveCharacterTextSplitter(["<Chunk>", '\n\n', '\n', ' '], 1024, 0);

        for (const file of sorted(os.listdir(doc_dir))) {
            console.log("Загружается файл: ", file);
            const fileContent = fs.readFileSync(path.join(doc_dir, file), 'utf-8');
            for (const chunk of await splitter.splitText(fileContent)) {
                this.source_chunks.push(new Document(chunk, { 'source': `/content/${file}` }));
            }
        }


        this.search_index = new Chroma(this.source_chunks, new OpenAIEmbeddings(), { persistDirectory: persistDirectory });
        this.search_index.persist();

        const count_token = num_tokens_from_string(' '.join(this.source_chunks.map(x => x.pageContent)), "cl100k_base");
        console.log('\n ===========================================: ');
        console.log('Количество токенов в документе :', count_token);
        console.log('ЦЕНА запроса:', 0.0004 * (count_token / 1000), ' $ \n');
    }

    num_tokens_from_messages(messages: any[]): number {
        function encoding_for_model(model: any): tiktoken.Encoding {
            try {
                return tiktoken.encoding_for_model(model);
            } catch (error) {
                return tiktoken.get_encoding("cl100k_base");
            }
        }

        if (this.model === "gpt-3.5-turbo-0301") {
            let num_tokens = 0;
            for (const message of messages) {
                num_tokens += 4;
                for (const key in message) {
                    if (message.hasOwnProperty(key)) {
                        const value = message[key];
                        num_tokens += encoding_for_model(this.model).encode(value).length;
                        if (key === "name") {
                            num_tokens -= 1;
                        }
                    }
                }
            }
            num_tokens += 2;
            return num_tokens;
        } else {
            throw new Error(`num_tokens_from_messages() is not presently implemented for model ${this.model}.
      See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens.`);
        }
    }

    get_chatgpt_answer(topic: string): void {

        this.docs = await this.search_index.similaritySearch(topic, 4);
        this.message_content = re.sub(r'\n{2}', ' ', '\n '.join([f'\n=====' + doc.page_content + '\n' for i, doc in enumerate(this.docs)]));

        const messages = [
            { "role": "system", "content": this.chat_manager_system },
            { "role": "user", "content": `Analyze the texts of the documents ${this.message_content} and give a correct answer to the Student's question in detail: \n${topic}.` }
        ];

        try {
            const completion = await this.clientChatGpt.chat.completions.create({
                model: this.model,
                messages,
                temperature: 0.1
            });
            console.log('===========================================: ');
            console.log(`${completion["usage"]["total_tokens"]} токенов использовано всего (вопрос-ответ).`);
            console.log('===========================================: ');
            console.log('ЦЕНА запроса с ответом :', 0.002 * (completion["usage"]["total_tokens"] / 1000), ' $');
            console.log('===========================================: \n');
            console.log('Ответ ChatGPT: ');
            console.log(completion.choices[0].message.content);
        } catch {
            console.log("Эта модель в настоящее время перегружена. Попробуйте позже.");
        }
    }
}