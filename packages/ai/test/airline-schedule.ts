export type FlightEntry = {
  departure: string;
  arrival: string;
  date: string;
  seats: number;
};

export type FlightFilters = {
  departure?: string;
  arrival?: string;
  date?: string;
};

export class AirlineSchedule {
  private readonly flights: FlightEntry[];

  constructor(entries: FlightEntry[]) {
    this.flights = [...entries];
  }

  getAvailableFlights(filters: FlightFilters = {}): FlightEntry[] {
    const { departure, arrival, date } = filters;
    return this.flights.filter(
      f =>
        (departure ? f.departure === departure : true) &&
        (arrival ? f.arrival === arrival : true) &&
        (date ? f.date === date : true),
    );
  }
}
