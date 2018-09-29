import React, {Component} from 'react';
// import logo from './logo.svg';
import './App.css';

// this will include all the panels, the debugging and the whole page...
class Emulator extends Component {
  render() {
    return (
      <div className="App">
        <Game />
      </div>
    );
  }
}

class Game extends Component {
  constructor() {
    super();
    this.state = {};
  }

  // set up the game state.
  // FIXME: move this somewhere else? To game maybe
  componentDidMount() {}

  cpuLoop() {}

  render() {
    return <GameCanvas />;
  }
}

class GameCanvas extends Component {
  constructor() {
    super();
    this.state = {
      screen: new Array(64 * 32).fill(0), //2048 items
    };
  }
  render() {
    var screen = this.state.screen.map(isActive => {
      var className = isActive === 0 ? 'pixel' : 'pixel active';
      return <div className={className} />;
    });

    return <div className="canvas-container">{screen}</div>;
  }
}

// components for other parts of the page
// scrubber, codesurfer

export default Emulator;

// class App extends Component {
//   render() {
//     return (
//       <div className="App">
//         <GameCanvas />
//         <header className="App-header">
//           <img src={logo} className="App-logo" alt="logo" />
//           <h1 className="App-title">Welcome to React</h1>
//         </header>
//         <p className="App-intro">
//           To get started, edit <code>src/App.js</code> and save to reload.
//         </p>
//       </div>
//     );
//   }
// }
