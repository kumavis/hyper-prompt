"use client"

import styles from './page.module.css'
import { useState } from 'react'
import { ChatGPTAPI } from 'chatgpt'

const preprompt =
`
Respond only with a single HTML doc.
Do not respond with any other content.
Do not put the HTML doc in a frame.
Do not reference any external resources.
In the html doc, respond to the following query:
`

export default function Home() {
  const [pageDoc, setPageDoc] = useState()
  const [promptInput, setPromptInput] = useState('')

  const submitPrompt = async (event: Event) => {
    event.preventDefault();
    // get and reset prompt
    const prompt = promptInput
    setPromptInput('')
    // ask ai
    const apiKey = new URLSearchParams(location.search).get('apiKey')
    const api = new ChatGPTAPI({ apiKey })
    // workaround for https://github.com/transitive-bullshit/chatgpt-api/issues/592
    api._fetch = self.fetch.bind(self)
    console.log(`prompt: ${prompt}`)
    const formattedPrompt = `${preprompt}${prompt}`
    const res = await api.sendMessage(formattedPrompt)
    console.log(res.text)
    setPageDoc(res.text)
  }

  return (
    <main className={styles.main}>
      
      <div className={styles.description}>
        <h1 className={styles.title}>hyper prompt</h1>
      </div>
      
      <iframe className={styles.iframe} srcDoc={pageDoc} />
      
      <div className={styles.description}>
        <form onSubmit={submitPrompt}>
          <input className={styles.input} value={promptInput} onChange={(e) => setPromptInput(e.target.value)} />
        </form>
      </div>

    </main>
  )
}
