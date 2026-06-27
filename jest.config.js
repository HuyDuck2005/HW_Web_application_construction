export default {
    testEnvironment: 'node',
    clearMocks: true,
    restoreMocks: true,
    collectCoverageFrom: [
        'graphql-server/src/**/*.js',
        'services/**/src/**/*.js',
        '!**/node_modules/**',
        '!**/server.js',
        '!**/grpcServer.js',
    ],
    testMatch: [
        '**/__tests__/**/*.test.js'
    ]
};