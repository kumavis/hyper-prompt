"use client"

import styles from './page.module.css'
import { FormEvent, useCallback, useMemo, useRef, useState } from 'react'
import { ChatGPTAPI, ChatMessage } from 'chatgpt'
import type { SendMessageOptions } from 'chatgpt'
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

type Configuration = {
  apiKey?: string,
  model?: string,
  temperature?: string,
  top_p?: string,
}

const configuration: Configuration = {}

// client only / no pre-rendering
if (typeof self !== 'undefined') {
  const searchParams = new URLSearchParams(location.search)
  configuration.apiKey = searchParams.get('apiKey') || undefined
  configuration.model = searchParams.get('model') || 'gpt-4'
  configuration.temperature = searchParams.get('temperature') || undefined
  configuration.top_p = searchParams.get('top_p') || undefined
}

type RequestResponsePair = {
  request: string,
  response?: ChatMessage,
  parentMessageId?: string,
}

class Conversation {
  api: ChatGPTAPI
  requestOpts?: SendMessageOptions
  messages: RequestResponsePair[] = []

  constructor (api: ChatGPTAPI, requestOpts?: SendMessageOptions) {
    this.api = api
    this.requestOpts = requestOpts
  }

  async sendMessage (message: string, onProgress?: (partialResponse: ChatMessage) => void) {
    const parentMessageId = this.lastMessage?.response?.id
    const thisMessagePair: RequestResponsePair = { request: message, parentMessageId }
    this.messages.push(thisMessagePair)
    const response = await this.api.sendMessage(message, {
      ...this.requestOpts,
      parentMessageId,
      onProgress: (partialResponse) => {
        thisMessagePair.response = partialResponse
        onProgress?.(partialResponse)
      }
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

export default function Home() {
  const [currentPrompt, setCurrentPrompt] = useState('')
  const currentPromptRef = useRef(currentPrompt)
  const [promptInput, setPromptInput] = useState('')
  const [isLoading, setLoading] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null);

  const convo = useMemo(() => {
    // client only / no pre-rendering
    if (typeof self !== 'undefined') {
      const { apiKey, model, temperature, top_p } = configuration
      if (!apiKey || typeof apiKey !== 'string') throw new Error('apiKey not found in query string')
      const api = new ChatGPTAPI({
        apiKey,
        completionParams: {
          model,
          ...(temperature && { temperature: parseFloat(temperature) }),
          ...(top_p && { top_p: parseFloat(top_p) }),
        },
        debug: true,
        // workaround for https://github.com/transitive-bullshit/chatgpt-api/issues/592
        fetch: self.fetch.bind(self),
      })
      // track messages
      return new Conversation(api, {
        systemMessage: preprompt,
      })
    }
  }, [])

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // get and reset prompt
    const prompt = promptInput
    setPromptInput('')
    setCurrentPrompt(prompt)
    currentPromptRef.current = prompt
    setLoading(true)
    // run prompt
    processPrompt(prompt)
  }

  const processPrompt = async (prompt: string) => {
    // ask ai
    console.log(`prompt: ${prompt}`)
    if (!convo) throw new Error('missing convo')
    const [docStart, docEnd] = docFormat.split('__RESPONSE__')
    frameRef.current?.contentWindow?.document.open()
    frameRef.current?.contentWindow?.document.write(docStart)
    const res = await convo.sendMessage(prompt, (partialResponse) => {
      if (!convo) throw new Error('missing convo')
      if (!partialResponse.delta) return
      if (prompt !== currentPromptRef.current) {
        console.log('prompt mismatch', {
          prompt,
          currentPrompt: currentPromptRef.current,
        })
        return
      }
      console.log(`got response partial`)
      if (!frameRef.current) {
        console.error('missing iframe ref!')
        return
      }

      const frame = frameRef.current
      frame.contentWindow?.document.write(partialResponse.delta)
    })
    console.log('prompt response complete', res)
    frameRef.current?.contentWindow?.document.write(docEnd)
    frameRef.current?.contentWindow?.document.close()
    setLoading(false)
  }

  const updateIframeDoc = useCallback((iframeElement: HTMLIFrameElement) => {
    const frameGlobal = iframeElement.contentWindow
    // @ts-ignore
    frameGlobal.aiPrompt = (newPrompt: string) => {
      setCurrentPrompt(newPrompt)
      processPrompt(newPrompt)
    }
  }, [])

  return (
    <main className={styles.main}>
      
      <div className={styles.description}>
        <h1 className={styles.title}>hyper prompt</h1>
      </div>
      
      <div className={styles.promptInput}>
        <form onSubmit={submitPrompt}>
          <button
            className={styles.loadingIcon}
            disabled={isLoading}
          >
            {isLoading ? '%' : '>'}
          </button>
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
        ref={frameRef}
        // this should create a fresh frame for each prompt,
        // avoiding issues like persistent global variables (?)
        key={currentPrompt}
        onLoad={(event) => updateIframeDoc(event.target as HTMLIFrameElement)}
      />

    </main>
  )
}
