"use client"

import styles from './page.module.css'
import { FormEvent, useCallback, useState } from 'react'
import { ChatGPTAPI, ChatMessage } from 'chatgpt'

const preprompt =
`
Respond only with a single HTML fragment to be placed inside a <body>.
Do not respond with any other content.
Do not put the HTML in a frame or backticks.
Do not reference any external resources.
You may use javascript to allow the user easily ask premade follow up questions.
\`aiPrompt(promptString)\` will be available in the global scope.
If your answer contains a list (<ol>), you should ALWAYS use \`aiPrompt\` to provide follow up questions digging deeper into the answer.
For example, if the prompt is "how to fix a car", you may respond with "<ol><li><a href="javascript:aiPrompt('how to change the oil?')">change the oil"</a></li><li><a href="javascript:aiPrompt('how to change the tires?')">change the tires</a></li></ol>".
Only call \`aiPrompt\` in response to a user interaction.
When possible implement an interactive widget or animated simulation to help the user understand the answer.
Draw a canvas image or svg diagram to help the user understand the answer.
Always include additional prompts to relevant topics and follow up questions.
If you need more information from the user, create a form with a submit button that calls \`aiPrompt\` with the user input.

In the html doc, respond to the following query:
`

const docFormat =
`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>hyper prompt</title>
    <style>
    a {
      text-decoration: none;
    }
    </style>
  </head>
  <body>
    __RESPONSE__
  </body>
</html>
`

type RequestResponsePair = {
  request: string,
  response?: ChatMessage,
}

class Conversation {
  api: ChatGPTAPI
  requestOpts?: object
  messages: RequestResponsePair[] = []

  constructor (api: ChatGPTAPI, requestOpts?: object) {
    this.api = api
    this.requestOpts = requestOpts
  }

  async sendMessage (message: string) {
    const thisMessagePair: RequestResponsePair = { request: message }
    this.messages.push(thisMessagePair)
    const response = await this.api.sendMessage(message, {
      ...this.requestOpts,
      parentMessageId: this.lastMessage?.response?.id,
    })
    thisMessagePair.response = response
    return response
  }

  get lastMessage () {
    return this.messages[this.messages.length - 1]
  }

  fork() {
    const convo = new Conversation(this.api, this.requestOpts)
    convo.messages = [...this.messages]
    return convo
  }
} 

let api: ChatGPTAPI
let convo: Conversation
// client only / no pre-rendering
if (typeof self !== 'undefined') {
  const apiKey = new URLSearchParams(location.search).get('apiKey')
  if (!apiKey) throw new Error('apiKey not found in query string')
  api = new ChatGPTAPI({
    apiKey,
    completionParams: {
      model: 'gpt-4',
      // temperature: 0.5,
      // top_p: 0.8
    },
    debug: true,
    // workaround for https://github.com/transitive-bullshit/chatgpt-api/issues/592
    fetch: self.fetch.bind(self),
  })
  // track messages
  convo = new Conversation(api, {
    systemMessage: preprompt,
  })
}

export default function Home() {
  const [currentPrompt, setCurrentPrompt] = useState('')
  const [promptInput, setPromptInput] = useState('')
  const [pageDoc, setPageDoc] = useState('')

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // get and reset prompt
    const prompt = promptInput
    setPromptInput('')
    setCurrentPrompt(prompt)
    processPrompt(prompt)
  }

  const processPrompt = async (prompt: string) => {
    // ask ai
    console.log(`prompt: ${prompt}`)
    const res = await convo.sendMessage(prompt)
    // format response
    const formattedPageDoc = docFormat.replace('__RESPONSE__', res.text)
    setPageDoc(formattedPageDoc)
  }

  const updateIframeDoc = useCallback((iframeElement: HTMLIFrameElement) => {
    const frameGlobal = iframeElement.contentWindow
    // @ts-ignore
    frameGlobal.aiPrompt = (newPrompt: string) => {
      // const accepted = confirm(`the ai prompt is:\n${newPrompt}`)
      // if (accepted) {
        setCurrentPrompt(newPrompt)
        processPrompt(newPrompt)
      // }
    }
  }, [])


  return (
    <main className={styles.main}>
      
      <div className={styles.description}>
        <h1 className={styles.title}>hyper prompt</h1>
      </div>
      
      <div className={styles.promptInput}>
        <form onSubmit={submitPrompt}>
          <input
            className={styles.input}
            value={promptInput}
            placeholder={currentPrompt}
            onChange={(e) => setPromptInput(e.target.value)}
          />
        </form>
      </div>
      <iframe
        className={styles.iframe}
        srcDoc={pageDoc}
        onLoad={(event) => updateIframeDoc(event.target as HTMLIFrameElement)}
      />

    </main>
  )
}
