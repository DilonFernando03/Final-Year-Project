import React, {useState} from 'react'
import {Link} from 'react-router-dom';
import './Navbar.css';

function Navbar() {
    const [click, setClick] = useState(false);
    const handleClick = () => setClick(!click);
    const closeMobileMenu = () => setClick(false);
  return (
    <>
      <nav className='navbar'>
        <div className='navbar-container'>
            <Link to="/" className="navbar-logo">
            F1 Dashboard <i class="fa-solid fa-flag-checkered"></i>
            </Link>
        </div>
      </nav>
    </>
  )
}

export default Navbar
