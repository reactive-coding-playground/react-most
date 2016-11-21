import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';
import * as most from 'most';
import Most, {connect} from '../react-most';
import {do$, historyStreamOf, intentStreamOf} from '../test-utils'

const CounterView = props=> (
  <div>
    <span className="count">{props.count}</span>
    <span className="wrapperProps">{props.wrapperProps}</span>
    <span className="overwritedProps">{props.overwritedProps}</span>
    <span className="backward" onClick={props.history.backward}>-</span>
    <span className="forward" onClick={props.history.forward}>+</span>
  </div>
)

CounterView.defaultProps = {count: 0, overwritedProps: 'inner'}

const Counter = connect(intent$=>{
  return {
    sink$: intent$.map(intent=>{
      switch(intent.type) {
        case 'inc': return state=>({count:state.count+1})
        case 'dec':
          intent$.send({type:'dec triggered'})
          return state=>({count:state.count-1})
        case 'changeWrapperProps':
          return state=>({wrapperProps: intent.value,
                          overwritedProps: intent.value})
        case 'changeDefaultProps':
          return state=>({count: intent.value})
        default:
          return state=>state
      }
    }),
    inc: ()=>({type:'inc'}),
    dec: ()=>({type:'dec'}),
    changeWrapperProps: (value)=>({type:'changeWrapperProps', value}),
    changeDefaultProps: (value)=>({type:'changeDefaultProps', value}),
  }
})(CounterView)

describe('react-most', () => {
  describe('actions', ()=>{
    it('add intent to intent$ and go through sink$', ()=> {
      let counterWrapper = TestUtils.renderIntoDocument(
        <Most >
          <Counter history={true} />
        </Most>
      )
      let counter = TestUtils.findRenderedComponentWithType(counterWrapper, Counter)

      do$([()=>counter.actions.inc(),
           ()=>counter.actions.fromPromise(Promise.resolve({type:'inc'})),
           ()=>counter.actions.fromEvent({type:'inc'})])

      return historyStreamOf(counter)
        .take$(3)
        .then(state=>expect(state.count).toEqual(3))
    })

    it('sink can also generate intent', ()=> {
      let counterWrapper = TestUtils.renderIntoDocument(
        <Most >
          <Counter history={true} />
        </Most>
      )
      let counter = TestUtils.findRenderedComponentWithType(counterWrapper, Counter)

      do$([()=>counter.actions.dec()])

      return intentStreamOf(counter)
        .take(2).observe(_=>_)
        .then(intent=>expect(intent.type).toEqual('dec triggered'))
    })

    it('props will overwirte components default props', ()=>{
      let counterWrapper = TestUtils.renderIntoDocument(
        <Most >
          <Counter count={9} history={true} />
        </Most>
      )
      let counter = TestUtils.findRenderedComponentWithType(counterWrapper, Counter)

      do$([()=>counter.actions.inc()])
      return historyStreamOf(counter)
        .take$(1)
        .then(state=>expect(state.count).toBe(10))
    })

    it('props that not overlap with views defaultProps can not be changed', ()=>{
      let CounterWrapper = React.createClass({
        getInitialState(){
          return {
            wrapperProps: 'heheda',
            overwritedProps: 'hoho',
            count: 0,
          }
        },
        render(){
          return <Counter
                     count={this.state.count}
                     wrapperProps={this.state.wrapperProps}
                     overwritedProps={this.state.overwritedProps}
                     history={true} />
        }

      })
      let counterMostWrapper = TestUtils.renderIntoDocument(
        <Most >
          <CounterWrapper />
        </Most>
      )
      let counterWrapper = TestUtils.findRenderedComponentWithType(counterMostWrapper, CounterWrapper)
      let counter = TestUtils.findRenderedComponentWithType(counterWrapper, Counter)

      return do$([
        ()=>counter.actions.changeWrapperProps('miao'),
        ()=>counter.actions.changeDefaultProps(19)
      ]).then(()=>{
        let wrapperProps = TestUtils.findRenderedDOMComponentWithClass(counter, 'wrapperProps')
        let overwritedProps = TestUtils.findRenderedDOMComponentWithClass(counter, 'overwritedProps')
        let count = TestUtils.findRenderedDOMComponentWithClass(counter, 'count')
        expect(counter.props.wrapperProps).toBe('heheda')
        expect(wrapperProps.textContent).toBe('miao')
        expect(overwritedProps.textContent).toBe('miao')
        expect(count.textContent).toBe('19')
        return do$([
          ()=>counterWrapper.setState({overwritedProps: 'wrapper', count: 1})
        ])
      }).then(()=>{
        let overwritedProps = TestUtils.findRenderedDOMComponentWithClass(counter, 'overwritedProps')
        let count = TestUtils.findRenderedDOMComponentWithClass(counter, 'count')
        expect(overwritedProps.textContent).toBe('wrapper')
        expect(count.textContent).toBe('1')
      })
    })
  });

  describe('history', ()=>{
    it('can undo', ()=> {
      let counterWrapper = TestUtils.renderIntoDocument(
        <Most >
          <Counter history={true} />
        </Most>
      )
      let counter = TestUtils.findRenderedComponentWithType(counterWrapper, Counter)
      return do$([
        ()=>counter.actions.inc(),
        ()=>counter.actions.inc(),
        ()=>counter.actions.inc()
      ]).then(()=>{
        let backward = TestUtils.findRenderedDOMComponentWithClass(counterWrapper, 'backward')
        TestUtils.Simulate.click(backward)
        TestUtils.Simulate.click(backward)
        TestUtils.Simulate.click(backward)
      }).then(()=>{
        let count = TestUtils.findRenderedDOMComponentWithClass(counterWrapper, 'count')
        expect(count.textContent).toBe('1')
      }).then(()=>{
        let forward = TestUtils.findRenderedDOMComponentWithClass(counterWrapper, 'forward')
        TestUtils.Simulate.click(forward)
      }).then(()=>{
        let count = TestUtils.findRenderedDOMComponentWithClass(counterWrapper, 'count')
        expect(count.textContent).toBe('2')
      }).then(()=>{
        let forward = TestUtils.findRenderedDOMComponentWithClass(counterWrapper, 'forward')
        TestUtils.Simulate.click(forward)
        TestUtils.Simulate.click(forward)
      }).then(()=>{
        let count = TestUtils.findRenderedDOMComponentWithClass(counterWrapper, 'count')
        expect(count.textContent).toBe('3')
      })
    })
  })
})
