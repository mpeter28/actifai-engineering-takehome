jest.mock('pg', () => {
  const mockClient = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  };
  return { Client: jest.fn(() => mockClient), __mockClient: mockClient };
});

const { __mockClient: mockClient } = require('pg');
const { performanceMetricsForUser, performanceMetricsForGroup } = require('./performanceMetrics');

describe('performanceMetricsForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next with an error when userId is not a number', async () => {
    const req = { body: { userId: "not a number" } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("userId must be a number"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('computes averageRevenuePerSale correctly', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { time_interval: '2021-09', number_of_sales: 4, total_revenue: 100 },
      ],
    });

    const req = { body: { userId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      userId: 1,
      metricSeries: [
        { timeInterval: '2021-09', numberOfSales: 4, totalRevenue: 100, averageRevenuePerSale: 25 },
      ],
    });
  });

  it('averageRevenuePerSale equals totalRevenue when there is one sale', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { time_interval: '2021-09', number_of_sales: 1, total_revenue: 75 },
      ],
    });

    const req = { body: { userId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      userId: 1,
      metricSeries: [
        { timeInterval: '2021-09', numberOfSales: 1, totalRevenue: 75, averageRevenuePerSale: 75 },
      ],
    });
  });

  it('maps multiple months into metricSeries', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { time_interval: '2021-09', number_of_sales: 2, total_revenue: 200 },
        { time_interval: '2021-10', number_of_sales: 5, total_revenue: 500 },
      ],
    });

    const req = { body: { userId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      userId: 1,
      metricSeries: [
        { timeInterval: '2021-09', numberOfSales: 2, totalRevenue: 200, averageRevenuePerSale: 100 },
        { timeInterval: '2021-10', numberOfSales: 5, totalRevenue: 500, averageRevenuePerSale: 100 },
      ],
    });
  });

  it('returns empty metricSeries when query returns no rows', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const req = { body: { userId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      userId: 1,
      metricSeries: [],
    });
  });

  it('passes the userId to the query', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const req = { body: { userId: 42 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [42, '0000-01', '9999-12']);
  });

  it('passes startMonth and stopMonth to the query', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const req = { body: { userId: 1, startMonth: '2021-06', stopMonth: '2021-12' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [1, '2021-06', '2021-12']);
  });

  it('calls next with an error when startMonth is a number', async () => {
    const req = { body: { userId: 1, startMonth: 202109 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("startMonth and stopMonth must be in YYYY-MM format"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next with an error when startMonth is not YYYY-MM format', async () => {
    const req = { body: { userId: 1, startMonth: 'June' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("startMonth and stopMonth must be in YYYY-MM format"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next with an error when stopMonth is not YYYY-MM format', async () => {
    const req = { body: { userId: 1, stopMonth: '2021' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("startMonth and stopMonth must be in YYYY-MM format"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next with an error when stopMonth is a number', async () => {
    const req = { body: { userId: 1, stopMonth: 202112 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("startMonth and stopMonth must be in YYYY-MM format"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next with the error when the database query fails', async () => {
    const dbError = new Error("connection refused");
    mockClient.query.mockRejectedValueOnce(dbError);

    const req = { body: { userId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForUser(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.json).not.toHaveBeenCalled();
    expect(mockClient.end).toHaveBeenCalled();
  });
});

describe('performanceMetricsForGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next with an error when groupId is not a number', async () => {
    const req = { body: { groupId: "not a number" } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("groupId must be a number"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('computes averageRevenuePerSale and averageRevenuePerActiveSeller correctly', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { time_interval: '2021-09', number_of_sales: 4, number_of_users: 2, total_revenue: 100 },
      ],
    });

    const req = { body: { groupId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      groupId: 1,
      metricSeries: [
        { timeInterval: '2021-09', numberOfSales: 4, totalRevenue: 100, averageRevenuePerSale: 25, averageRevenuePerActiveSeller: 50 },
      ],
    });
  });

  it('single sale and single user means averages equal totalRevenue', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { time_interval: '2021-09', number_of_sales: 1, number_of_users: 1, total_revenue: 60 },
      ],
    });

    const req = { body: { groupId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      groupId: 1,
      metricSeries: [
        { timeInterval: '2021-09', numberOfSales: 1, totalRevenue: 60, averageRevenuePerSale: 60, averageRevenuePerActiveSeller: 60 },
      ],
    });
  });

  it('maps multiple months into metricSeries', async () => {
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { time_interval: '2021-09', number_of_sales: 2, number_of_users: 1, total_revenue: 200 },
        { time_interval: '2021-10', number_of_sales: 5, number_of_users: 5, total_revenue: 500 },
      ],
    });

    const req = { body: { groupId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      groupId: 1,
      metricSeries: [
        { timeInterval: '2021-09', numberOfSales: 2, totalRevenue: 200, averageRevenuePerSale: 100, averageRevenuePerActiveSeller: 200 },
        { timeInterval: '2021-10', numberOfSales: 5, totalRevenue: 500, averageRevenuePerSale: 100, averageRevenuePerActiveSeller: 100 },
      ],
    });
  });

  it('returns empty metricSeries when query returns no rows', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const req = { body: { groupId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      groupId: 1,
      metricSeries: [],
    });
  });

  it('passes the groupId to the query', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const req = { body: { groupId: 7 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [7, '0000-01', '9999-12']);
  });

  it('passes startMonth and stopMonth to the query', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const req = { body: { groupId: 1, startMonth: '2021-06', stopMonth: '2021-12' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(mockClient.query).toHaveBeenCalledWith(expect.any(String), [1, '2021-06', '2021-12']);
  });

  it('calls next with an error when startMonth is a number', async () => {
    const req = { body: { groupId: 1, startMonth: 202109 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("startMonth and stopMonth must be in YYYY-MM format"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next with an error when startMonth is not YYYY-MM format', async () => {
    const req = { body: { groupId: 1, startMonth: 'June' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("startMonth and stopMonth must be in YYYY-MM format"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next with an error when stopMonth is not YYYY-MM format', async () => {
    const req = { body: { groupId: 1, stopMonth: '2021' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("startMonth and stopMonth must be in YYYY-MM format"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next with an error when stopMonth is a number', async () => {
    const req = { body: { groupId: 1, stopMonth: 202112 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(next).toHaveBeenCalledWith(new Error("startMonth and stopMonth must be in YYYY-MM format"));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('calls next with the error when the database query fails', async () => {
    const dbError = new Error("connection refused");
    mockClient.query.mockRejectedValueOnce(dbError);

    const req = { body: { groupId: 1 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await performanceMetricsForGroup(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.json).not.toHaveBeenCalled();
    expect(mockClient.end).toHaveBeenCalled();
  });
});
