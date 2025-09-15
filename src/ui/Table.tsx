import React from 'react'
import { cn } from '../lib/utils'

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  // fluid: sin wrapper con overflow ni min-width, se adapta al contenedor
  fluid?: boolean
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, fluid = false, ...props }, ref) => {
    return (
      <div className={cn('w-full', !fluid && 'overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0')}>
        <table
          ref={ref}
          className={cn('w-full text-sm', !fluid && 'min-w-[600px]', className)}
          {...props}
        />
      </div>
    )
  }
)

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={cn('border-b border-primary', className)}
        {...props}
      />
    )
  }
)

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => {
    return <tbody ref={ref} className={cn(className)} {...props} />
  }
)

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={cn(
          'border-b border-primary glass-hover transition-colors',
          className
        )}
        {...props}
      />
    )
  }
)

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn(
          'text-center font-medium text-secondary px-2 sm:px-4 py-3 text-xs sm:text-sm',
          className
        )}
        {...props}
      />
    )
  }
)

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={cn('text-center px-2 sm:px-4 py-3 text-xs sm:text-sm', className)}
        {...props}
      />
    )
  }
)

Table.displayName = 'Table'
TableHeader.displayName = 'TableHeader'
TableBody.displayName = 'TableBody'
TableRow.displayName = 'TableRow'
TableHead.displayName = 'TableHead'
TableCell.displayName = 'TableCell'
