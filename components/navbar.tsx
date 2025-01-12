import React from 'react'
import { ModeToggle } from './mode-toggle'

const Navbar = () => {
  return (
    <header className='w-full p-2 shadow-2xl flex justify-between items-center fixed top-0'>
        <p className='font-bold text-xl'>Rekise Marine Assignment</p>
        <ModeToggle />
    </header>
  )
}

export default Navbar