const GRAPH = {
    nodes: [
      {
        label: 'Cysteine Biosynthesis',
        x: -332,
        y: -17.5,
        id: '690c3362-ff4b-45fb-a1e8-feef6089a512',
        group: 'chemical'
      },
      {
        label: 'CysB',
        x: -401,
        y: -171.5,
        id: '172e2203-8af7-4cc8-bf95-274636cd126b',
        group: 'gene'
      },
      {
        label: 'cysB*',
        x: -337,
        y: -11.5,
        id: '2bb5ae7d-829a-4273-b318-8937df2615da',
        group: 'gene'
      },
      {
        label: 'Causation',
        x: -337,
        y: -99.5,
        id: 'd685ec64-f8f0-4949-99ae-47c2fddf108b',
        group: 'entity'
      },
      {
        label: 'PBP1B',
        x: -71,
        y: 63.5,
        id: '3752fb5e-d1e6-41d2-95c3-f66e18684669',
        group: 'gene'
      },
      {
        label: 'LpoB',
        x: -53,
        y: 99.5,
        id: 'de0195f7-8b43-4e87-9fcd-980d666e695f',
        group: 'gene'
      },
      {
        label: 'FtsZ',
        x: -142,
        y: 136.5,
        id: '3619edc3-b114-40f6-9c79-2a3094ac6d40',
        group: 'gene'
      },
      {
        label: 'Mecillinam',
        x: 90.27189376187019,
        y: -212.152514239778,
        id: 'd856ff25-b186-494c-88f2-ee1807ca00a8',
        group: 'chemical'
      },
      {
        label: 'Study',
        x: -336.8031485726064,
        y: -314.0681493423235,
        id: 'c1fad068-aa88-40ce-af9d-212a2540bbd1',
        group: 'entity'
      },
      {
        label: 'E.coli',
        x: -23.29124249525199,
        y: -302.4206481877469,
        id: 'e7bc40fb-293f-4a86-be1f-2fc2de726aa9',
        group: 'species'
      },
      {
        label: 'Urinary Tract Infection',
        x: -336.8031485726064,
        y: -428.6019106956604,
        id: '412d9088-1a8f-41f4-bbe0-031d4b1cf46c',
        group: 'entity'
      },
      {
        label: 'mrcB',
        x: 95.1250192429438,
        y: -41.32249730598737,
        id: '12dfd823-31bf-4b15-bdc4-46bfa899633c',
        group: 'gene'
      },
      {
        label: 'IpoB',
        x: 89.30126866565547,
        y: 54.769387219269866,
        id: 'a07c5a49-557e-45fd-8f55-9f72000f53ab',
        group: 'gene'
      },
      {
        label: 'Peptide Glycan Biosynthesis',
        x: 54.35876520192557,
        y: 242.10003078871074,
        id: '592a84b1-0280-4d77-8bc4-94cbdf26a845',
        group: 'chemical'
      }
    ],
    edges: [
      {
        id: '2e5c7885-44ba-4183-bf98-d7d8b4f7afb3',
        label: 'encodes',
        from: '2bb5ae7d-829a-4273-b318-8937df2615da',
        to: '172e2203-8af7-4cc8-bf95-274636cd126b'
      },
      {
        id: '313e4ec9-6701-4583-8bb2-ce75c6043608',
        label: null,
        from: '172e2203-8af7-4cc8-bf95-274636cd126b',
        to: '690c3362-ff4b-45fb-a1e8-feef6089a512'
      },
      {
        id: '991f261a-f073-4614-aa09-638a39d0bf11',
        label: 'mutation_of',
        from: 'd685ec64-f8f0-4949-99ae-47c2fddf108b',
        to: '2bb5ae7d-829a-4273-b318-8937df2615da'
      },
      {
        id: 'a909f049-09c1-4dca-a66c-756b28aee266',
        label: 'upregulates',
        from: '2bb5ae7d-829a-4273-b318-8937df2615da',
        to: '3752fb5e-d1e6-41d2-95c3-f66e18684669'
      },
      {
        id: 'fdc82b62-d197-4f46-886a-baba8f0de54b',
        label: 'upregulates',
        from: '2bb5ae7d-829a-4273-b318-8937df2615da',
        to: 'de0195f7-8b43-4e87-9fcd-980d666e695f'
      },
      {
        id: 'b046c591-b3e5-4f71-9338-dc4278be45ea',
        label: 'upregulates',
        from: '2bb5ae7d-829a-4273-b318-8937df2615da',
        to: '3619edc3-b114-40f6-9c79-2a3094ac6d40'
      },
      {
        id: 'dfecd2b9-b39b-4a0b-9439-ad9e8a75cc94',
        label: 'resistance_to',
        from: 'd685ec64-f8f0-4949-99ae-47c2fddf108b',
        to: 'd856ff25-b186-494c-88f2-ee1807ca00a8'
      },
      {
        id: 'bb803d0e-46bd-42d4-bb24-f9c3e3de0e47',
        label: 'related_to',
        from: 'c1fad068-aa88-40ce-af9d-212a2540bbd1',
        to: 'e7bc40fb-293f-4a86-be1f-2fc2de726aa9'
      },
      {
        id: 'eba8fd5a-f31f-4f03-b42e-eb9cc5079af5',
        label: null,
        from: 'c1fad068-aa88-40ce-af9d-212a2540bbd1',
        to: 'd685ec64-f8f0-4949-99ae-47c2fddf108b'
      },
      {
        id: 'de78c2d5-4c9a-4981-803a-161da32f0964',
        label: 'related_to',
        from: 'c1fad068-aa88-40ce-af9d-212a2540bbd1',
        to: '412d9088-1a8f-41f4-bbe0-031d4b1cf46c'
      },
      {
        id: 'd4a4c953-68bc-4cdf-9032-0158f3a077c8',
        label: 'encodes',
        from: 'a07c5a49-557e-45fd-8f55-9f72000f53ab',
        to: 'de0195f7-8b43-4e87-9fcd-980d666e695f'
      },
      {
        id: 'f98a3454-d2b1-4fdb-be43-9fffdfd9d875',
        label: 'encodes',
        from: '12dfd823-31bf-4b15-bdc4-46bfa899633c',
        to: '3752fb5e-d1e6-41d2-95c3-f66e18684669'
      },
      {
        id: '62f27e05-a125-4a94-bf94-c6ce1b0f3891',
        label: null,
        from: '3619edc3-b114-40f6-9c79-2a3094ac6d40',
        to: '592a84b1-0280-4d77-8bc4-94cbdf26a845'
      },
      {
        id: '1e6f15b5-c4e8-452b-8967-3f1d9df0ac67',
        label: null,
        from: 'de0195f7-8b43-4e87-9fcd-980d666e695f',
        to: '592a84b1-0280-4d77-8bc4-94cbdf26a845'
      },
      {
        id: 'c698378d-6837-4759-8962-34807f414a99',
        label: null,
        from: '3752fb5e-d1e6-41d2-95c3-f66e18684669',
        to: '592a84b1-0280-4d77-8bc4-94cbdf26a845'
      }
    ]
};

export const sampleProject = {
    id: '690c3362-ff4b-45fb-a1e8-feef6089a512',
    label: 'Sample',
    description: '',
    graph: GRAPH
};
