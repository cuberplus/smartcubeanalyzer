import { describe, expect, test } from '@jest/globals';
import { parseCsv } from '../Helpers/CsvParser';
import { Solve } from '../Helpers/Types';

const cubeastSample = `id,date,dnf,time,solving_method,device_name,device_model,device_color_scheme,user,one_turn_away_two_second_penalty,inspection_two_second_penalty,inspection_time,timer_time,missing_turn,solution,timer,description,session_name,session_ruleset,scramble,scramble_provider,ruleset,share_views,share_likes,share_comments,analysis_version,solution_rotation,pickup_time,putdown_time,solving_time,slice_turns,face_turns,quarter_turns,turns_per_second,total_recognition_time,total_execution_time,turns_after_solution,steps_skipped,step_0_name,step_0_moves,step_0_recorded_moves,step_0_skipped,step_0_has_turns,step_0_time,step_0_recognition_time,step_0_execution_time,step_0_cumulative_time,step_0_slice_turns,step_0_face_turns,step_0_quarter_turns,step_0_turns_per_second,step_1_name,step_1_moves,step_1_recorded_moves,step_1_skipped,step_1_has_turns,step_1_time,step_1_recognition_time,step_1_execution_time,step_1_cumulative_time,step_1_slice_turns,step_1_face_turns,step_1_quarter_turns,step_1_turns_per_second,step_2_name,step_2_moves,step_2_recorded_moves,step_2_skipped,step_2_has_turns,step_2_time,step_2_recognition_time,step_2_execution_time,step_2_cumulative_time,step_2_slice_turns,step_2_face_turns,step_2_quarter_turns,step_2_turns_per_second,step_3_name,step_3_moves,step_3_recorded_moves,step_3_skipped,step_3_has_turns,step_3_time,step_3_recognition_time,step_3_execution_time,step_3_cumulative_time,step_3_slice_turns,step_3_face_turns,step_3_quarter_turns,step_3_turns_per_second,step_4_name,step_4_moves,step_4_recorded_moves,step_4_skipped,step_4_has_turns,step_4_time,step_4_recognition_time,step_4_execution_time,step_4_cumulative_time,step_4_slice_turns,step_4_face_turns,step_4_quarter_turns,step_4_turns_per_second,step_5_name,step_5_moves,step_5_recorded_moves,step_5_skipped,step_5_has_turns,step_5_time,step_5_recognition_time,step_5_execution_time,step_5_cumulative_time,step_5_slice_turns,step_5_face_turns,step_5_quarter_turns,step_5_turns_per_second,step_6_name,step_6_moves,step_6_recorded_moves,step_6_skipped,step_6_has_turns,step_6_time,step_6_recognition_time,step_6_execution_time,step_6_cumulative_time,step_6_slice_turns,step_6_face_turns,step_6_quarter_turns,step_6_turns_per_second,step_7_name,step_7_moves,step_7_recorded_moves,step_7_skipped,step_7_has_turns,step_7_time,step_7_recognition_time,step_7_execution_time,step_7_cumulative_time,step_7_slice_turns,step_7_face_turns,step_7_quarter_turns,step_7_turns_per_second,step_8_name,step_8_moves,step_8_recorded_moves,step_8_skipped,step_8_has_turns,step_8_time,step_8_recognition_time,step_8_execution_time,step_8_cumulative_time,step_8_slice_turns,step_8_face_turns,step_8_quarter_turns,step_8_turns_per_second,step_0_case,step_1_case,step_2_case,step_3_case,step_4_case,step_5_case,step_6_case,step_7_case,step_8_case
7d11ba20-55d3-489f-a075-6298f216367d,2026-01-05 15:09:52 UTC,false,25755,CFOP,12uiFp-pof,Gan 12 UI FreePlay,Gan 356i,Pau,false,false,23424,25755,,U'[0] B[172] R[529] B[953] L[1730] F[2214] D'[2461] L[2795] D'[3226] U'[5452] U[5831] R'[6309] U[6432] R[6560] U'[6825] F[7047] U[7234] F'[7404] U'[9527] U'[9633] R[10188] U'[10348] R'[10465] R'[10681] U[10838] R[10968] L[12441] U[12631] L'[12718] B'[14048] U[14147] U[14239] B[14500] U'[14834] U'[14919] B'[15029] U[15156] B[15280] U'[17033] R[17319] U[17498] R'[17600] U'[17739] R[17811] U[17950] R'[18054] R'[19873] F[20055] R[20302] R'[20584] R[20649] U[20749] R'[20926] F'[21160] R[21327] F[21619] U'[21920] F'[22098] U[22721] R'[23365] R'[23518] F[23664] R[23767] U[23907] R[24018] U'[24150] R'[24271] F'[24473] R[24666] U'[24830] U'[24917] R'[25013] U[25226] U[25320] R[25755],,,PAU-2026-01,custom_rules,D2 B' U D2 B D F' D' R L U2 L2 D' R2 U2 B2 U' B2 U B2 U2 L2,random_state,custom_rules,,,,8,UF,0,0,25755,68,68,75,2.64,12618,13137,"",0,Cross,U' B R B L F D' L D',U'[0] B[172] R[529] B[953] L[1730] F[2214] D'[2461] L[2795] D'[3226],false,true,3226,0,3226,3226,9,9,9,2.79,F2L Slot 1,U' U R' U R U' F U F',U'[5452] U[5831] R'[6309] U[6432] R[6560] U'[6825] F[7047] U[7234] F'[7404],false,true,4178,3083,1095,7404,9,9,9,8.22,F2L Slot 2,U2' R U' R2' U R,U2'[9633] R[10188] U'[10348] R2'[10681] U[10838] R[10968],false,true,3564,2784,780,10968,6,6,8,7.69,F2L Slot 3,L U L' B' U2 B U2' B' U B,L[12441] U[12631] L'[12718] B'[14048] U2[14239] B[14500] U2'[14919] B'[15029] U[15156] B[15280],false,true,4312,1473,2839,15280,10,10,12,3.52,F2L Slot 4,U' R U R' U' R U R',U'[17033] R[17319] U[17498] R'[17600] U'[17739] R[17811] U[17950] R'[18054],false,true,2774,2039,735,18054,8,8,8,10.88,OLL,R' F R R' R U R' F' R F U' F',R'[19873] F[20055] R[20302] R'[20584] R[20649] U[20749] R'[20926] F'[21160] R[21327] F[21619] U'[21920] F'[22098],false,true,4044,1819,2225,22098,12,12,12,5.39,PLL,U R2' F R U R U' R' F' R U2' R' U2 R,U[22721] R2'[23518] F[23664] R[23767] U[23907] R[24018] U'[24150] R'[24271] F'[24473] R[24666] U2'[24917] R'[25013] U2[25320] R[25755],false,true,3657,1420,2237,25755,14,14,17,6.26,,,,,,,,,,,,,,,,,,,,,,,,,,,,113,BL->FR 91,"[FL,BR]->FR 30",27,14,Rb,,`

const acubemySample = `solve_id,date,total_time,scramble,solution,turns,tps,move_times,analysis_type,device_name,session_name,raw_solution,raw_timestamps,gyro_data,cross_face,cross_moves,cross_time,cross_execution_time,f2l_pair1_moves,f2l_pair1_time,f2l_pair1_recognition_time,f2l_pair1_execution_time,f2l_pair2_moves,f2l_pair2_time,f2l_pair2_recognition_time,f2l_pair2_execution_time,f2l_pair3_moves,f2l_pair3_time,f2l_pair3_recognition_time,f2l_pair3_execution_time,f2l_pair4_moves,f2l_pair4_time,f2l_pair4_recognition_time,f2l_pair4_execution_time,oll_case_id,oll_moves,oll_time,oll_recognition_time,oll_execution_time,pll_case_name,pll_moves,pll_time,pll_recognition_time,pll_execution_time
139047,2026-01-08T10:32:50.222Z,27167,B2 L2 U L2 U' F2 R2 D2 L2 U R2 L' B2 R' F' L F U R' D B R2 U2,x2 D B' D2' R' L2 D2' x' x U L U L' U F U F' U' R U' R' f R f' U R R' U R' F R F' U2 R U R' y' U' U2' L' U' F' F U L L' U' L U F U F' R U R' U' R' F R F' x' x U' R U' R' U' R U R D R' U' R D' R' U2 R' U2',79,2.9079397798800013,"0 0 644 1336 1902 2308 2864 4409 5295 5387 5624 5819 5879 6421 6723 6989 7187 8791 8968 9192 9464 10187 10229 10502 11323 11474 11804 12118 12344 12451 12599 12748 13082 13326 13518 13632 15314 17578 18449 18614 18884 19064 19332 19771 20058 20415 20668 20797 20954 21238 21421 21570 22620 22798 22876 22992 23119 23176 23309 23415 24014 24331 24372 24797 25002 25078 25241 25376 25560 25606 25786 25965 26111 26233 26368 26567 26808 26909 27167",CFOP,GAN12ui--B3C,PAU-2026-01,,,,U,"x2 D B' D2' R' L2 D2'",2864,2864,"x' x U L U L' U F U F'",4323,1545,2778,"U' R U' R' f R f'",3191,1480,1711,"U R R' U R' F R F' U2 R U R' y'",3254,-737,3991,"U' U2' L' U' F' F U L L' U' L U F U F'",7938,3946,3992,32,"R U R' U' R' F R F'",1845,1050,795,Ra,"x' x U' R U' R' U' R U R D R' U' R D' R' U2 R' U2'",3752,599,3153`;

describe('CsvParser', () => {
    test('parses Cubeast CSV into solves', () => {
        const solves: Solve[] = parseCsv(cubeastSample, ',');
        expect(solves.length).toBe(1);
        const solve = solves[0];
        expect(solve.source).toBe('cubeast');
        expect(solve.rawSource).toBe('cubeast');
        expect(solve.rawSourceId).toBe('7d11ba20-55d3-489f-a075-6298f216367d');
        expect(solve.session).toBe('PAU-2026-01');
        expect(solve.crossColor).toBe('Yellow'); // UF solution rotation maps to Yellow cross
    });

    test('Cubeast AUF adjustment moves leading AUF time from recognition to execution', () => {
        const solves: Solve[] = parseCsv(cubeastSample, ',');
        expect(solves.length).toBe(1);
        const solve = solves[0];
        // F2L Slot 1 has leading U'[5452] U[5831] R'[6309] -> AUF duration = 6309 - 5452 = 857 ms
        const step1 = solve.steps[1];
        expect(step1.name).toBe('F2L Slot 1');
        expect(step1.recognitionTime).toBeCloseTo(3.083 - 0.857, 3); // was 3083 ms
        expect(step1.executionTime).toBeCloseTo(1.095 + 0.857, 3);   // was 1095 ms
        // Solve totals are recomputed from adjusted steps
        const sumRec = solve.steps.reduce((s, st) => s + st.recognitionTime, 0);
        const sumExec = solve.steps.reduce((s, st) => s + st.executionTime, 0);
        expect(solve.recognitionTime).toBeCloseTo(sumRec, 3);
        expect(solve.executionTime).toBeCloseTo(sumExec, 3);
    });

    test('Cubeast AUF adjustment is not applied to Cross step', () => {
        const solves: Solve[] = parseCsv(cubeastSample, ',');
        expect(solves.length).toBe(1);
        const solve = solves[0];

        const cross = solve.steps[0];
        expect(cross.name).toBe('Cross');
        // Raw Cubeast cross timing from CSV: time 3226 ms, recognition 0 ms, execution 3226 ms.
        expect(cross.time).toBeCloseTo(3.226, 3);
        expect(cross.recognitionTime).toBeCloseTo(0, 3);
        expect(cross.executionTime).toBeCloseTo(3.226, 3);

        // Sanity check: AUF adjustment is still applied to later steps like F2L Slot 1.
        const f2l1 = solve.steps[1];
        expect(f2l1.name).toBe('F2L Slot 1');
        expect(f2l1.recognitionTime).toBeLessThan(3.083);
        expect(f2l1.executionTime).toBeGreaterThan(1.095);
    });

    test('Cubeast steps with no leading AUF are unchanged', () => {
        const solves: Solve[] = parseCsv(cubeastSample, ',');
        const solve = solves[0];
        // Step 5 OLL: R'[19873] F[20055]... - no leading AUF, so recognition/execution unchanged
        const oll = solve.steps[5];
        expect(oll.name).toBe('OLL');
        // OLL raw: recognition 1819 ms, execution 2225 ms. No leading AUF -> no change
        expect(oll.recognitionTime).toBeCloseTo(1.819, 3);
        expect(oll.executionTime).toBeCloseTo(2.225, 3);
    });

    test('parses Acubemy CSV into solves', () => {
        const solves: Solve[] = parseCsv(acubemySample, ',');
        expect(solves.length).toBe(1);
        const solve = solves[0];
        expect(solve.source).toBe('acubemy');
        expect(solve.rawSource).toBe('acubemy');
        expect(solve.rawSourceId).toBe('139047');
        expect(solve.session).toBe('PAU-2026-01');
        // Turns/TPS are now recomputed from the solution field, ignoring rotations.
        // The original CSV reports 79 turns including rotations; after removing
        // rotations from the solution we get 73 effective turns.
        expect(solve.turns).toBe(73);
        expect(solve.tps).toBeCloseTo(73 / (27167 / 1000), 3);
        expect(solve.crossColor).toBe('Yellow'); // cross_face U -> Yellow
        expect(solve.inspectionTime).toBeCloseTo(0, 3);
        expect(solve.steps[0].name).toBe('Cross');
        expect(solve.steps[1].name).toBe('F2L Slot 1');
        expect(solve.steps[5].name).toBe('OLL');
        expect(solve.steps[6].name).toBe('PLL');

        // Total solve recognition time for Acubemy should match the sum of
        // the provided step-level recognition times (cross recognition is 0).
        const stepRecognitionSum = solve.steps
            .slice(1, 7) // F2L1-4, OLL, PLL
            .reduce((acc, step) => acc + step.recognitionTime, 0);
        expect(solve.recognitionTime).toBeCloseTo(stepRecognitionSum, 3);
    });

    test('Acubemy move counting ignores rotations', () => {
        const csv = `solve_id,date,total_time,scramble,solution,turns,tps,move_times,analysis_type,device_name,session_name,raw_solution,raw_timestamps,gyro_data,cross_face,cross_moves,cross_time,cross_execution_time,f2l_pair1_moves,f2l_pair1_time,f2l_pair1_recognition_time,f2l_pair1_execution_time,f2l_pair2_moves,f2l_pair2_time,f2l_pair2_recognition_time,f2l_pair2_execution_time,f2l_pair3_moves,f2l_pair3_time,f2l_pair3_recognition_time,f2l_pair3_execution_time,f2l_pair4_moves,f2l_pair4_time,f2l_pair4_recognition_time,f2l_pair4_execution_time,oll_case_id,oll_moves,oll_time,oll_recognition_time,oll_execution_time,pll_case_name,pll_moves,pll_time,pll_recognition_time,pll_execution_time
1,2026-01-08T10:32:50.222Z,10000,,x y R U R' x2 y2 z U2 L',0,0,,CFOP,DEV,TEST,,,,U,x y R U R' x2 y2,2000,2000,,,,,,,,,,,,,,,,,0,z U2 L',3000,3000,,,,x' R F R',5000,5000`;

        const solves: Solve[] = parseCsv(csv, ',');
        expect(solves.length).toBe(1);
        const solve = solves[0];

        // solution: x y R U R' x2 y2 z U2 L'
        // Non-rotation tokens: R, U, R', U2, L'  -> 5 turns
        expect(solve.turns).toBe(5);
        expect(solve.tps).toBeCloseTo(5 / 10, 5); // total_time = 10000 ms -> 10 s

        // cross_moves: x y R U R' x2 y2  -> 3 non-rotation tokens (R, U, R')
        expect(solve.steps[0].turns).toBe(3);

        // oll_moves: z U2 L' -> 2 non-rotation tokens (U2, L')
        expect(solve.steps[5].turns).toBe(2);
    });

    test('Acubemy recomputes step recognition/execution using rotations between steps as recognition for next step', () => {
        const csv = `solve_id,date,total_time,scramble,solution,turns,tps,move_times,analysis_type,device_name,session_name,raw_solution,raw_timestamps,gyro_data,cross_face,cross_moves,cross_time,cross_execution_time,f2l_pair1_moves,f2l_pair1_time,f2l_pair1_recognition_time,f2l_pair1_execution_time,f2l_pair2_moves,f2l_pair2_time,f2l_pair2_recognition_time,f2l_pair2_execution_time,f2l_pair3_moves,f2l_pair3_time,f2l_pair3_recognition_time,f2l_pair3_execution_time,f2l_pair4_moves,f2l_pair4_time,f2l_pair4_recognition_time,f2l_pair4_execution_time,oll_case_id,oll_moves,oll_time,oll_recognition_time,oll_execution_time,pll_case_name,pll_moves,pll_time,pll_recognition_time,pll_execution_time
1,2026-01-08T10:32:50.222Z,8000,,x R U y U' L',0,0,"0 1000 2000 3000 4000 5000",CFOP,DEV,TEST,,,,U,x R U,3000,3000,y U' L',5000,2000,3000,,,,,,,,,,,,,0,,,0,0,,,0,0`;

        const solves: Solve[] = parseCsv(csv, ',');
        const solve = solves[0];

        const cross = solve.steps[0];
        const f2l1 = solve.steps[1];

        // Global timeline:
        // 0ms:  x   (rotation)
        // 1000: R   (cross first non-rotation)
        // 2000: U   (cross last non-rotation)
        // 3000: y   (rotation between steps)
        // 4000: U'  (F2L1 first non-rotation)
        // 5000: L'  (F2L1 last non-rotation)

        // Cross: recognition from 0 -> 1000, execution from 1000 -> 2000.
        expect(cross.recognitionTime).toBeCloseTo(1.0, 5);
        expect(cross.executionTime).toBeCloseTo(1.0, 5);

        // F2L1: recognition from previous step's last non-rotation (2000) to first non-rotation (4000),
        // so it includes the intermediate rotation y at 3000.
        expect(f2l1.recognitionTime).toBeCloseTo(2.0, 5);
        expect(f2l1.executionTime).toBeCloseTo(1.0, 5);

        // Totals are consistent with per-step sums.
        const sumRec = solve.steps.reduce((s, st) => s + st.recognitionTime, 0);
        const sumExec = solve.steps.reduce((s, st) => s + st.executionTime, 0);
        expect(solve.recognitionTime).toBeCloseTo(sumRec, 5);
        expect(solve.executionTime).toBeCloseTo(sumExec, 5);
    });

    test('Acubemy OLL/PLL skips are treated as Solved cases', () => {
        const csv = `solve_id,date,total_time,analysis_type,device_name,session_name,cross_face,oll_case_id,pll_case_name
1,2026-01-08T10:32:50.222Z,10000,CFOP,DEV,TEST,U,-1,Unknown`;

        const solves: Solve[] = parseCsv(csv, ',');
        expect(solves.length).toBe(1);
        const solve = solves[0];

        expect(solve.steps[5].name).toBe('OLL');
        expect(solve.steps[6].name).toBe('PLL');

        // OLL skip: Acubemy encodes oll_case_id as -1; treat as "Solved"
        expect(solve.steps[5].case).toBe('Solved');

        // PLL skip: Acubemy encodes pll_case_name as "Unknown"; treat as "Solved"
        expect(solve.steps[6].case).toBe('Solved');
    });
});

