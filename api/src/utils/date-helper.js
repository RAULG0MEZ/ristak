/**
 * Helper para manejar fechas de manera consistente en toda la app
 * Asegura que cuando se filtra por un solo día, incluya TODO el día (00:00:00 a 23:59:59)
 */

function adjustDateRange(startDate, endDate) {
  // Crear copias para no mutar los originales
  const adjustedStartDate = new Date(startDate);
  const adjustedEndDate = new Date(endDate);

  // Ajustar inicio del día (00:00:00.000)
  adjustedStartDate.setHours(0, 0, 0, 0);

  // Ajustar fin del día (23:59:59.999)
  adjustedEndDate.setHours(23, 59, 59, 999);

  return {
    startDate: adjustedStartDate,
    endDate: adjustedEndDate
  };
}

module.exports = {
  adjustDateRange
};