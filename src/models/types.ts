export interface OrderLevel {
    price: number;
    size: number;
  }
  
  export interface Orderbook {
    bids: OrderLevel[];
    asks: OrderLevel[];
  }
  
  