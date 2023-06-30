"use client"

import styles from './page.module.css'
import { FormEvent, useCallback, useState } from 'react'
import { ChatGPTAPI } from 'chatgpt'

const preprompt =
`
Respond only with a single HTML fragment to be placed inside a <body>.
Do not respond with any other content.
Do not put the HTML in a frame.
Do not reference any external resources.
You may use javascript to allow the user easily ask premade follow up questions.
\`aiPrompt(promptString)\` will be available in the global scope.
If your answer contains a list (<ol>), you should ALWAYS use \`aiPrompt\` to provide follow up questions digging deeper into the answer.
For example, if the prompt is "how to fix a car", you may respond with "<ol><li><a href="javascript:aiPrompt('how to change the oil?')">change the oil"</a></li><li><a href="javascript:aiPrompt('how to change the tires?')">change the tires</a></li></ol>".
Only call \`aiPrompt\` in response to a user interaction.

In the html doc, respond to the following query:
`

const docFormat =
`
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>hyper prompt</title>
  </head>
  <body>
    __RESPONSE__
  </body>
</html>
`

export default function Home() {
  const [pageDoc, setPageDoc] = useState('')
  const [promptInput, setPromptInput] = useState('')

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // get and reset prompt
    const prompt = promptInput
    setPromptInput('')
    processPrompt(prompt)
  }

  const processPrompt = async (prompt: string) => {
    // ask ai
    const apiKey = new URLSearchParams(location.search).get('apiKey')
    if (!apiKey) throw new Error('apiKey not found in query string')
    const api = new ChatGPTAPI({
      apiKey,
      completionParams: {
        model: 'gpt-4',
        // temperature: 0.5,
        // top_p: 0.8
      },
      // workaround for https://github.com/transitive-bullshit/chatgpt-api/issues/592
      fetch: self.fetch.bind(self),
    })
    console.log(`prompt: ${prompt}`)
    const formattedPrompt = `${preprompt}${prompt}`
    const res = await api.sendMessage(formattedPrompt)
    console.log(res.text)
    // format response
    const formattedPageDoc = docFormat.replace('__RESPONSE__', res.text)
    setPageDoc(formattedPageDoc)
  }

  const updateIframeDoc = useCallback((iframeElement: HTMLIFrameElement) => {
    const frameGlobal = iframeElement.contentWindow
    console.log('preparing aiPrompt')
    // @ts-ignore
    frameGlobal.aiPrompt = (newPrompt: string) => {
      const accepted = confirm(`the ai prompt is:\n${newPrompt}`)
      if (accepted) {
        processPrompt(newPrompt)
      }
    }
  }, [])


  return (
    <main className={styles.main}>
      
      <div className={styles.description}>
        <h1 className={styles.title}>hyper prompt</h1>
      </div>
      
      <iframe
        className={styles.iframe}
        srcDoc={pageDoc}
        onLoad={(event) => updateIframeDoc(event.target as HTMLIFrameElement)}
      />
      
      <div className={styles.description}>
        <form onSubmit={submitPrompt}>
          <input className={styles.input} value={promptInput} onChange={(e) => setPromptInput(e.target.value)} />
        </form>
      </div>

    </main>
  )
}
