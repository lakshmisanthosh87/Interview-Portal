import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { SignInButton } from '@clerk/clerk-react'

function App() {
 

  return (
    <>
    <h1>welcome to app</h1>
    <SignInButton mode="model"/>
    </>
  )
}

export default App
