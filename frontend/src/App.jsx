
import { SignInButton, SignOutButton, SignedIn, SignedOut, UserButton, useUser} from '@clerk/clerk-react'
import { Navigate, Route, Routes } from 'react-router'
import HomePage from './pages/HomePage'
import ProblemsPage from './pages/ProblemsPage'
import DashboardPage from './pages/DashboardPage'
import ProblemPage from './pages/ProblemPage'
import { Toaster } from 'react-hot-toast'


function App() {
  const {isSignedIn, isLoaded}= useUser()

  if(!isLoaded) return null

  return (
    <>
      
      <Routes>
        <Route
          path="/"
          element={!isSignedIn ? <HomePage /> : <Navigate to={"/dashboard"} />}
        />

        <Route
          path="/dashboard"
          element={isSignedIn ? <DashboardPage /> : <Navigate to={"/"} />}
        />

        <Route
          path="/problems"
          element={isSignedIn ? <ProblemsPage /> : <Navigate to={"/"} />}
        />

        {/* Problem detail page with dynamic ID/slug */}
        <Route
          path="/problem/:id"
          element={isSignedIn ? <ProblemPage /> : <Navigate to={"/"} />}
        />

        {/* Optional: if someone hits /problem without an id, send them to list */}
        <Route path="/problem" element={<Navigate to="/problems" />} />
      </Routes>

      <Toaster/>
    </>
  )
}

export default App
