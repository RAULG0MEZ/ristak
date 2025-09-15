import React from 'react'
import { Card, Button } from '../../ui'
import { Icons } from '../../icons'
import { formatCurrency } from '../../lib/utils'
import type { BankCard } from '../../types'

const cards: BankCard[] = [
  {
    id: '1',
    name: 'Fundly',
    type: 'visa',
    number: '**** **** **** 3456',
    balance: 86320.25,
    currency: 'USD',
    gradient: 'from-orange-400 via-pink-400 to-purple-400',
  },
]

export function MyCards() {
  return (
    <Card variant="glass" className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">My Cards</h3>
        <Button variant="ghost" size="sm">
          Show All
          <Icons.chevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      <div className="space-y-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`relative rounded-xl p-4 h-48 bg-gradient-to-br ${card.gradient || 'from-blue-500 to-purple-600'} overflow-hidden`}
          >
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative h-full flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-glass-subtle flex items-center justify-center">
                    <span className="text-white font-bold text-xs">F</span>
                  </div>
                  <span className="text-white font-semibold">{card.name}</span>
                </div>
                <span className="text-white/80 text-sm font-medium uppercase">{card.type}</span>
              </div>

              <div>
                <p className="text-white/60 text-xs mb-1">Total Balance</p>
                <p className="text-white text-2xl font-bold">
                  {formatCurrency(card.balance)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-4">
        <Button variant="secondary" size="sm" className="flex-1">
          <Icons.send className="w-4 h-4 mr-2" />
          Send
        </Button>
        <Button variant="secondary" size="sm" className="flex-1">
          <Icons.request className="w-4 h-4 mr-2" />
          Request
        </Button>
      </div>
    </Card>
  )
}