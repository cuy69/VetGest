export const dateTime = (value: string) => new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
export const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value)
