import openai, { langchain } from "OpenAi";
import {CharacterTextSplitter} from "langchain/text_splitter";
import {Chroma} from "langchain/vectorstores";
import {OpenAIEmbeddings} from "langchain/embeddings";
import {ChatCompletion} from "openai/resources/chat";
import { request } from "express";
import { tiktoken, Endcoding } from "tiktoken";





// class bcolors {
//
//     constructor() {}
//
//     static HEADER: string = '\033[95m'
//     static OKBLUE: string = '\033[94m';
//     static OKCYAN: string = '\033[96m';
//     static OKGREEN: string = '\033[92m';
//     static WARNING: string = '\033[93m';
//     static FAIL: string = '\033[91m';
//     static ENDC: string = '\033[0m';
//     static BOLD: string = '\033[1m';
//     static UNDERLINE: string = '\033[4m';
// }

// Здесь просто создаётся класс bcolors, как в пайтоне.
// Тут статические свойства, это цветовые коды ANSI для форматирования текста в терминале, я их пока что указал через точку,.


class GPT {
    constructor() {}

    static setKey(): void {
        // Тут создаются элементы DOM для ввода пароля и кнопки авторизации
        const passwordInput: HTMLInputElement = document.createElement("input");
        passwordInput.type = "password";
        passwordInput.placeholder = "Введите пароль:";
        passwordInput.style.width = "500px";
        const loginButton: HTMLButtonElement = document.createElement("button");
        loginButton.textContent = "Авторизация";
        const output: HTMLElement = document.createElement("div");

        // Обработчик события клика по кнопке авторизации
        loginButton.addEventListener("click", () => {
            // Получаем введенный API-ключ и сохраняем его
            const openaiApiKey: string = passwordInput.value;
            openai.api_key = openaiApiKey;
            process.env.OPENAI_API_KEY = openaiApiKey;
            // console.log(`${bcolors.OKGREEN}${bcolors.BOLD}Ключ сохранен!${bcolors.ENDC}`);
            console.log(`Ключ сохранен!`);

            passwordInput.style.display = 'none';
            loginButton.style.display = 'none';
        });

        // Создаем контейнер для элементов ввода и вывода
        const container: HTMLElement = document.createElement("div");
        container.appendChild(passwordInput);
        container.appendChild(loginButton);
        container.appendChild(output);
        document.body.appendChild(container);
    }

    // Метод setKey создает элементы ввода пароля и кнопки авторизации в веб-интерфейсе.
    // При клике на кнопку, введенный API-ключ сохраняется для использования с OpenAI.

    loadSearchIndexes(url: string): string {
        const match: RegExpMatchArray | null = url.match('/document/d/([a-zA-Z0-9-_]+)');
        if (match === null) {
            throw new Error('Invalid Google Docs URL');
        }
        const docId: string = match[1];

        const response: Response = requests.get(`https://docs.google.com/document/d/${docId}/export?format=txt`);
        response.raiseForStatus();
        const text: string = response.text;
        return this.createEmbedding(text);
    }

    // Этот метод принимает URL Google Docs и извлекает текст документа из него.
    // Регулярка для извлечения идентификатора документа из URL.
    // Потом HTTP-запрос для получения текста документа и текст передается методу createEmbedding.

    loadPrompt(url: string): string {
        const match: RegExpMatchArray | null = url.match('/document/d/([a-zA-Z0-9-_]+)');
        if (match === null) {
            throw new Error('Invalid Google Docs URL');
        }
        const docId: string = match[1];

        const response: Response = requests.get(`https://docs.google.com/document/d/${docId}/export?format=txt`);
        response.raiseForStatus();
        const text: string = response.text;
        return `${text}`;
    }

    //Почти как loadSearchIndexes, но возвращает текст документа без дополнительной обработки.

    createEmbedding(data: string): string {
        function numTokensFromString(string: string, encodingName: string): number {
            const encoding: Encoding = tiktoken.get_encoding(encodingName);
            const numTokens: number = encoding.encode(string).length;
            return numTokens;
        }

        // Создание массива документов из текста
        const sourceChunks: Document[] = [];
        const splitter: CharacterTextSplitter = new CharacterTextSplitter("\n", 1024, 0);

        for (const chunk of splitter.split_text(data)) {
            sourceChunks.push(new Document(chunk, {}));
        }

        // Создание индекса поиска и расчет стоимости запроса
        const searchIndex: Chroma = await Chroma.fromDocuments(sourceChunks, new OpenAIEmbeddings());

        const countToken: number = numTokensFromString(sourceChunks.map(x => x.page_content).join(' '), "cl100k_base");
        console.log('\n ===========================================: ');
        console.log('Количество токенов в документе :', countToken);
        console.log('ЦЕНА запроса:', 0.0004 * (countToken / 1000), ' $');
        return searchIndex;
    }

    // В этом методе текст документа разбивается на чанки, как ты до этого говорил про максимальное кол-во токенов и создается индекс поиска (searchIndex)
    // с использованием библиотеки Chroma.
    // Кроме того, расчитывается количество токенов в документе и его стоимость на основе числа токенов.

    answer(system: string, topic: string, temp: number = 1): string {
        const messages: { role: string; content: string }[] = [
            { role: "system", content: system },
            { role: "user", content: topic },
        ];

        const completion: ChatCompletion = openai.ChatCompletion.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: temp,
        });

        return completion.choices[0].message.content;
    }

    //Метод answer принимает системное сообщение, тему и температуру и возвращает ответ от модели GPT-3.5 Turbo, используя OpenAI API, как настройка бота.

    numTokensFromMessages(messages: any[], model: string = "gpt-3.5-turbo-0301"): number {
        function encodingForModel(model: string): Encoding {
            try {
                return tiktoken.encoding_for_model(model);
            } catch (error) {
                return tiktoken.get_encoding("cl100k_base");
            }
        }

        // Расчет числа токенов в сообщениях
        if (model === "gpt-3.5-turbo-0301") {
            let numTokens: number = 0;
            for (const message of messages) {
                numTokens += 4;
                for (const key in message) {
                    if (message.hasOwnProperty(key)) {
                        const value: any = message[key];
                        numTokens += encodingForModel(model).encode(value).length;
                        if (key === "name") {
                            numTokens -= 1;
                        }
                    }
                }
            }
            numTokens += 2;
            return numTokens;
        } else {
            throw new Error(`num_tokens_from_messages() is not presently implemented for model ${model}. See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens.`);
        }
    }

    // Этот метод подсчитывает количество токенов в сообщениях, учитывая модель, используемую для генерации ответов.

    insertNewlines(text: string, maxLen: number = 170): string {
        const words: string[] = text.split(' ');
        const lines: string[] = [];
        let currentLine: string = "";

        // Разбивка текста на строки с ограниченной длиной
        for (const word of words) {
            if (currentLine.length + word.length + 1 > maxLen) {
                lines.push(currentLine);
                currentLine = "";
            }
            currentLine += (currentLine.length === 0 ? "" : " ") + word;
        }

        lines.push(currentLine);
        return lines.join('\n');
    }

    // Этот метод разбивает текст на строки с ограниченной длиной, чтобы обеспечить более удобное отображение текста.


    dialog(): string {
        let user: string = "";
        let dialog: string = "";

        // console.log(`${bcolors.OKBLUE}${bcolors.BOLD}С чем связан ваш интерес к искусственному интеллекту?${bcolors.ENDC}`);
        console.log(`С чем связан ваш интерес к искусственному интеллекту?`);


        while (user.toLowerCase() !== "stop" && user.toLowerCase() !== "exit" && user.toLowerCase() !== "выход") {
            user = prompt('Клиент: ') || '';
            if (user.toLowerCase() === 'stop') break;

            dialog += '\n\n' + 'Клиент: ' + user;
            const addDialog: string = this.answer(expertPrompt, user);

            dialog += '\n\n' + 'Менеджер: ' + addDialog;
            // console.log(`\n${bcolors.OKBLUE}${bcolors.BOLD}Менеджер:${bcolors.ENDC} ${this.insertNewlines(addDialog)}`);
            console.log(`\n Менеджер: ${this.insertNewlines(addDialog)}`);
            const report: string = this.answer(validationPrompt, dialog);
            const answer: string = this.answer(actionPrompt, report);

            // console.log(`\n${bcolors.OKGREEN}${bcolors.BOLD}Отчёт системы:\n ${bcolors.ENDC}${report}`);
            // console.log(`\n${bcolors.HEADER}${bcolors.BOLD}Менеджер: ${bcolors.ENDC}${this.insertNewlines(answer)}\n\n`);

            console.log(`\n Отчёт системы:\n ${report}`);
            console.log(`\n Менеджер: ${bcolors.ENDC}${this.insertNewlines(answer)}\n\n`);



        }

        return dialog;
    }

    // Этот метод запускает диалог между клиентом и менеджером, где клиент вводит текстовые сообщения.
    // Он использует метод answer для генерации ответов менеджера и выводит их в консоль.

    answerIndex(system: string, topic: string, searchIndex: Chroma, temp: number = 1, verbose: number = 0): void {
        const docs: any[] = searchIndex.similarity_search(topic, 5);
        if (verbose) console.log('\n ===========================================: ');
        const messageContent: string = docs.map((doc, i) => `\nОтрывок документа №${i + 1}\n=====================${doc.page_content}\n`).join('\n ');
        if (verbose) console.log('message_content :\n ======================================== \n', messageContent);

        const messages: { role: string; content: string }[] = [
            { role: "system", content: system + `${messageContent}` },
            { role: "user", content: topic },
        ];

        if (verbose) console.log('\n ===========================================: ');
        if (verbose) console.log(`${this.numTokensFromMessages(messages, 'gpt-3.5-turbo-0301')} токенов использовано на вопрос`);

        const completion: ChatCompletion = openai.ChatCompletion.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: temp,
        });

        if (verbose) console.log('\n ===========================================: ');
        if (verbose) console.log(`${completion["usage"]["total_tokens"]} токенов использовано всего (вопрос-ответ).`);
        if (verbose) console.log('\n ===========================================: ');
        console.log('ЦЕНА запроса с ответом :', 0.002 * (completion["usage"]["total_tokens"] / 1000), ' $');
        if (verbose) console.log('\n ===========================================: ');
        console.log('ОТВЕТ : \n', this.insertNewlines(completion.choices[0].message.content));
    }

    // Этот метод выполняет поиск похожих документов в индексе (searchIndex) на основе заданной темы (topic).
    // Затем он генерирует ответ системы с учетом найденных документов и выводит его в консоль.
    // Также он выводит информацию о количестве использованных токенов и стоимости запроса.

    getChatGptAnswer3(system: string, topic: string, searchIndex: Chroma, temp: number = 1): void {
        const messages: { role: string; content: string }[] = [
            { role: "system", content: system },
            { role: "user", content: topic },
        ];

        const completion: ChatCompletion = openai.ChatCompletion.create({
            model: "gpt-3.5-turbo",
            messages: messages,
            temperature: temp,
        });

        console.log('ОТВЕТ : \n', this.insertNewlines(completion.choices[0].message.content));
    }

    //Этот метод аналогичен методу answer, но он не выводит вопрос и ответ в консоль, а просто возвращает ответ системы.
}

